import type { Job } from "bullmq";
import { db } from "@/db";
import { exchanges, participants, questions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSlackApp } from "@/slack/app";
import { buildNudgeMessage } from "@/slack/messages";
import type { NudgeJob } from "./queue";

/**
 * Send a nudge/reminder to a participant who hasn't responded.
 */
export async function sendNudge(job: Job<NudgeJob>): Promise<void> {
  const { participantId, exchangeId } = job.data;

  const participant = await db.query.participants.findFirst({
    where: eq(participants.id, participantId),
  });
  if (!participant || participant.status !== "active") return;

  const exchange = await db.query.exchanges.findFirst({
    where: and(eq(exchanges.id, exchangeId), eq(exchanges.status, "sent")),
  });
  if (!exchange) return; // Already answered or skipped

  const question = await db.query.questions.findFirst({
    where: eq(questions.id, exchange.questionId),
  });
  if (!question) return;

  // Calculate days since question was sent
  const daysSinceSent = exchange.askedAt
    ? Math.floor(
        (Date.now() - new Date(exchange.askedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 2;

  if (!participant.dmChannelId) return;

  const app = getSlackApp();
  await app.client.chat.postMessage({
    channel: participant.dmChannelId,
    text: `Friendly follow-up on my question from ${daysSinceSent === 1 ? "yesterday" : `${daysSinceSent} days ago`}`,
    blocks: buildNudgeMessage({
      participantName: participant.name.split(" ")[0],
      daysSinceSent,
      questionPreview:
        question.text.length > 150
          ? question.text.substring(0, 150) + "..."
          : question.text,
    }),
  });

  // Update nudge tracking
  await db
    .update(participants)
    .set({
      lastNudgeAt: new Date(),
      nudgeCount: (participant.nudgeCount || 0) + 1,
    })
    .where(eq(participants.id, participantId));
}
