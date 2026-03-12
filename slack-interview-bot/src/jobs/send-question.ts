import type { Job } from "bullmq";
import { db } from "@/db";
import {
  exchanges,
  participants,
  questions,
  projects,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSlackApp } from "@/slack/app";
import { buildQuestionMessage, buildCompletionMessage } from "@/slack/messages";
import { nudgeQueue } from "./queue";
import type { QuestionSendingJob } from "./queue";

/**
 * Send the next question to a participant via Slack DM.
 *
 * Flow:
 * 1. Verify participant is active and has a DM channel
 * 2. Check if they've already been sent an unanswered question (avoid double-send)
 * 3. Find the next approved, unsent question
 * 4. Create an exchange record
 * 5. Send the question via Slack DM
 * 6. Schedule a nudge for if they don't answer
 */
export async function sendNextQuestion(
  job: Job<QuestionSendingJob>
): Promise<void> {
  const { participantId } = job.data;

  const participant = await db.query.participants.findFirst({
    where: eq(participants.id, participantId),
  });
  if (!participant || participant.status !== "active") return;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, participant.projectId),
  });
  if (!project || project.status !== "interviewing") return;

  // Respect paused state
  if ((project.settings as any)?.paused) {
    console.log(`Project "${project.title}" is paused, skipping question send`);
    return;
  }

  // Ensure we have a DM channel before doing anything else
  let dmChannelId = participant.dmChannelId;
  if (!dmChannelId) {
    try {
      const app = getSlackApp();
      const dmResult = await app.client.conversations.open({
        users: participant.slackUserId,
      });
      dmChannelId = dmResult.channel?.id || null;
      if (dmChannelId) {
        await db
          .update(participants)
          .set({ dmChannelId })
          .where(eq(participants.id, participantId));
      }
    } catch (err) {
      console.error(`Cannot open DM with ${participant.name}:`, err);
      return;
    }
  }

  if (!dmChannelId) {
    console.error(`No DM channel for participant ${participant.name}, cannot send question`);
    return;
  }

  // Guard against double-send: if there's already a sent (unanswered) exchange, bail out
  const alreadySent = await db.query.exchanges.findFirst({
    where: and(
      eq(exchanges.participantId, participantId),
      eq(exchanges.status, "sent")
    ),
  });
  if (alreadySent) {
    console.log(`Participant ${participant.name} already has a pending question, skipping`);
    return;
  }

  // Count completed exchanges (answered + skipped) to determine sequence
  const existingExchanges = await db.query.exchanges.findMany({
    where: eq(exchanges.participantId, participantId),
    orderBy: (e, { asc }) => [asc(e.sequence)],
  });

  const nextSequence = existingExchanges.length + 1;
  const maxRounds = project.maxRounds || 10;

  // Check if participant has reached max rounds
  if (existingExchanges.length >= maxRounds) {
    await db
      .update(participants)
      .set({ status: "completed" })
      .where(eq(participants.id, participantId));

    const firstName = (participant.name || "there").split(" ")[0] || "there";
    const app = getSlackApp();
    try {
      await app.client.chat.postMessage({
        channel: dmChannelId,
        text: `Thanks so much, ${firstName}! That's all the questions.`,
        blocks: buildCompletionMessage({
          participantName: firstName,
          totalQuestions: existingExchanges.filter((e) => e.status === "answered").length,
          editorName: "the editor",
        }),
      });
    } catch (err) {
      console.error(`Failed to send completion message to ${participant.name}:`, err);
    }
    return;
  }

  // Find the next approved question that hasn't been used for this participant
  const usedQuestionIds = existingExchanges.map((e) => e.questionId);

  const allApproved = await db.query.questions.findMany({
    where: and(
      eq(questions.projectId, participant.projectId),
      eq(questions.approved, true)
    ),
    orderBy: (q, { asc }) => [asc(q.createdAt)],
  });

  // Priority sort: high > medium > low, then ai_followup > manual > ai_crosspoll
  const prioritized = allApproved
    .filter((q) => !usedQuestionIds.includes(q.id))
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const originOrder: Record<string, number> = {
        ai_followup: 0,
        manual: 1,
        ai_crosspoll: 2,
      };
      const aPrio = priorityOrder[a.priority] ?? 1;
      const bPrio = priorityOrder[b.priority] ?? 1;
      if (aPrio !== bPrio) return aPrio - bPrio;
      return (originOrder[a.origin] ?? 1) - (originOrder[b.origin] ?? 1);
    });

  const nextQuestion = prioritized[0];
  if (!nextQuestion) {
    console.log(`No more questions available for participant ${participant.name}`);
    return;
  }

  // Create the exchange record
  const [exchange] = await db
    .insert(exchanges)
    .values({
      projectId: participant.projectId,
      participantId,
      questionId: nextQuestion.id,
      sequence: nextSequence,
      status: "sent",
      askedAt: new Date(),
    })
    .returning();

  // Send via Slack
  const app = getSlackApp();
  try {
    const result = await app.client.chat.postMessage({
      channel: dmChannelId,
      text: nextQuestion.text,
      blocks: buildQuestionMessage({
        questionNumber: nextSequence,
        estimatedTotal: maxRounds,
        questionText: nextQuestion.text,
      }),
    });

    // Store the Slack message timestamp for threading
    if (result.ts) {
      await db
        .update(exchanges)
        .set({ slackMessageTs: result.ts })
        .where(eq(exchanges.id, exchange.id));
    }
  } catch (err) {
    // Slack send failed — mark exchange back to pending so it can retry
    console.error(`Failed to send question to ${participant.name}:`, err);
    await db
      .update(exchanges)
      .set({ status: "pending" })
      .where(eq(exchanges.id, exchange.id));
    throw err; // Let BullMQ retry the job
  }

  // Schedule a nudge in case they don't respond
  const nudgeHours = project.nudgeAfterHours || 48;
  await nudgeQueue.add(
    `nudge-${exchange.id}`,
    {
      participantId,
      exchangeId: exchange.id,
      projectId: project.id,
    },
    { delay: nudgeHours * 60 * 60 * 1000 }
  );
}
