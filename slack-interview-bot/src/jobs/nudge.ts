import type { Job } from "bullmq";
import { db } from "@/db";
import { exchanges, participants, questions, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSlackApp } from "@/slack/app";
import { buildNudgeMessage } from "@/slack/messages";
import type { NudgeJob } from "./queue";

const MIN_HOURS_BETWEEN_NUDGES = 12;
const MAX_NUDGES_PER_PARTICIPANT = 3;

/**
 * Send a nudge/reminder to a participant who hasn't responded.
 * Guards against duplicate nudges and respects max nudge limits.
 */
export async function sendNudge(job: Job<NudgeJob>): Promise<void> {
  const { participantId, exchangeId } = job.data;

  const participant = await db.query.participants.findFirst({
    where: eq(participants.id, participantId),
  });
  if (!participant || participant.status !== "active") return;

  // Guard: don't nudge if we recently nudged
  if (participant.lastNudgeAt) {
    const hoursSinceLast =
      (Date.now() - new Date(participant.lastNudgeAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLast < MIN_HOURS_BETWEEN_NUDGES) {
      console.log(`Skipping nudge for ${participant.name} — last nudge was ${hoursSinceLast.toFixed(1)}h ago`);
      return;
    }
  }

  // Guard: don't exceed max nudges
  if ((participant.nudgeCount || 0) >= MAX_NUDGES_PER_PARTICIPANT) {
    console.log(`Skipping nudge for ${participant.name} — reached max nudges (${MAX_NUDGES_PER_PARTICIPANT})`);
    return;
  }

  // If exchangeId is empty (e.g. from a delay-nudge), find the latest sent exchange
  let targetExchangeId = exchangeId;
  if (!targetExchangeId) {
    const latestSent = await db.query.exchanges.findFirst({
      where: and(
        eq(exchanges.participantId, participantId),
        eq(exchanges.status, "sent")
      ),
      orderBy: (e, { desc }) => [desc(e.sequence)],
    });
    if (!latestSent) return; // No pending question — nothing to nudge about
    targetExchangeId = latestSent.id;
  }

  const exchange = await db.query.exchanges.findFirst({
    where: and(eq(exchanges.id, targetExchangeId), eq(exchanges.status, "sent")),
  });
  if (!exchange) return; // Already answered or skipped since the nudge was scheduled

  const question = await db.query.questions.findFirst({
    where: eq(questions.id, exchange.questionId),
  });
  if (!question) return;

  if (!participant.dmChannelId) {
    console.error(`No DM channel for ${participant.name}, cannot nudge`);
    return;
  }

  // Calculate days since question was sent
  const daysSinceSent = exchange.askedAt
    ? Math.max(
        1,
        Math.floor(
          (Date.now() - new Date(exchange.askedAt).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 2;

  const firstName = (participant.name || "there").split(" ")[0] || "there";

  const app = getSlackApp();
  try {
    await app.client.chat.postMessage({
      channel: participant.dmChannelId,
      text: `Friendly follow-up on my question from ${daysSinceSent === 1 ? "yesterday" : `${daysSinceSent} days ago`}`,
      blocks: buildNudgeMessage({
        participantName: firstName,
        daysSinceSent,
        questionPreview:
          question.text.length > 150
            ? question.text.substring(0, 150) + "..."
            : question.text,
        nudgeNumber: (participant.nudgeCount || 0) + 1,
      }),
    });
  } catch (err) {
    console.error(`Failed to send nudge to ${participant.name}:`, err);
    throw err; // Let BullMQ retry
  }

  // Update nudge tracking
  await db
    .update(participants)
    .set({
      lastNudgeAt: new Date(),
      nudgeCount: (participant.nudgeCount || 0) + 1,
    })
    .where(eq(participants.id, participantId));
}
