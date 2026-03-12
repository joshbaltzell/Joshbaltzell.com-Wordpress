import { db } from "@/db";
import { exchanges, participants, projects } from "@/db/schema";
import { eq, and, lt, isNull } from "drizzle-orm";
import { nudgeQueue } from "./queue";

/**
 * Periodic job that scans for unanswered exchanges past their nudge threshold
 * and enqueues nudge jobs for them. Run this on a cron (e.g. every hour).
 *
 * This ensures participants get reminders even if the original nudge job
 * (scheduled at question-send time) was lost due to a Redis restart.
 */
export async function scheduleNudges(): Promise<{ scheduled: number }> {
  // Find all "sent" exchanges that are older than the project's nudge threshold
  const activeParticipants = await db.query.participants.findMany({
    where: and(
      eq(participants.status, "active"),
    ),
  });

  let scheduled = 0;

  for (const participant of activeParticipants) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, participant.projectId),
    });
    if (!project || project.status !== "interviewing") continue;

    const nudgeHours = project.nudgeAfterHours || 48;
    const nudgeThreshold = new Date(Date.now() - nudgeHours * 60 * 60 * 1000);

    // Find sent exchanges that are past the nudge threshold
    const staleExchanges = await db.query.exchanges.findMany({
      where: and(
        eq(exchanges.participantId, participant.id),
        eq(exchanges.status, "sent"),
        lt(exchanges.askedAt, nudgeThreshold)
      ),
    });

    for (const exchange of staleExchanges) {
      // Check if we recently nudged — avoid duplicates
      if (participant.lastNudgeAt) {
        const hoursSinceLast =
          (Date.now() - new Date(participant.lastNudgeAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < 12) continue;
      }

      // Max 3 nudges per participant
      if ((participant.nudgeCount || 0) >= 3) continue;

      await nudgeQueue.add(
        `cron-nudge-${exchange.id}`,
        {
          participantId: participant.id,
          exchangeId: exchange.id,
          projectId: project.id,
        },
        {
          // Deduplicate: if a nudge for this exchange is already in the queue, skip
          jobId: `nudge-${exchange.id}`,
        }
      );

      scheduled++;
    }
  }

  return { scheduled };
}
