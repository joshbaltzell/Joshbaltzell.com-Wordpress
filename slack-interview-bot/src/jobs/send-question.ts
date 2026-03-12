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
import type { QuestionSendingJob } from "./queue";

/**
 * Send the next question to a participant via Slack DM.
 *
 * Flow:
 * 1. Find the next approved, unsent question for this participant
 * 2. Create an exchange record
 * 3. Send the question via Slack DM
 * 4. Update the exchange with the Slack message timestamp
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

  // Count how many exchanges this participant already has
  const existingExchanges = await db.query.exchanges.findMany({
    where: eq(exchanges.participantId, participantId),
    orderBy: (e, { asc }) => [asc(e.sequence)],
  });

  const currentSequence = existingExchanges.length;
  const maxRounds = project.maxRounds || 10;

  // Check if participant has reached max rounds
  if (currentSequence >= maxRounds) {
    // Mark participant as completed
    await db
      .update(participants)
      .set({ status: "completed" })
      .where(eq(participants.id, participantId));

    // Send completion message
    if (participant.dmChannelId) {
      const app = getSlackApp();
      await app.client.chat.postMessage({
        channel: participant.dmChannelId,
        text: `Thanks so much! That's all the questions. Your insights are going to make this article great.`,
        blocks: buildCompletionMessage({
          participantName: participant.name.split(" ")[0],
          totalQuestions: currentSequence,
          editorName: "the editor",
        }),
      });
    }
    return;
  }

  // Find the next approved question that hasn't been assigned to this participant
  const usedQuestionIds = existingExchanges.map((e) => e.questionId);

  const allApproved = await db.query.questions.findMany({
    where: and(
      eq(questions.projectId, participant.projectId),
      eq(questions.approved, true)
    ),
    orderBy: (q, { asc }) => [asc(q.createdAt)],
  });

  // Priority: ai_followup (sourced from this participant) > manual > ai_crosspoll
  const prioritized = allApproved
    .filter((q) => !usedQuestionIds.includes(q.id))
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const originOrder: Record<string, number> = {
        ai_followup: 0,
        manual: 1,
        ai_crosspoll: 2,
      };
      const aPrio = priorityOrder[a.priority] ?? 1;
      const bPrio = priorityOrder[b.priority] ?? 1;
      if (aPrio !== bPrio) return aPrio - bPrio;
      const aOrig = originOrder[a.origin] ?? 1;
      const bOrig = originOrder[b.origin] ?? 1;
      return aOrig - bOrig;
    });

  const nextQuestion = prioritized[0];
  if (!nextQuestion) {
    console.log(
      `No more questions available for participant ${participant.name}`
    );
    return;
  }

  // Create the exchange record
  const [exchange] = await db
    .insert(exchanges)
    .values({
      projectId: participant.projectId,
      participantId,
      questionId: nextQuestion.id,
      sequence: currentSequence + 1,
      status: "sent",
      askedAt: new Date(),
    })
    .returning();

  // Send via Slack
  if (!participant.dmChannelId) {
    console.error(`No DM channel for participant ${participant.name}`);
    return;
  }

  const app = getSlackApp();
  const result = await app.client.chat.postMessage({
    channel: participant.dmChannelId,
    text: nextQuestion.text,
    blocks: buildQuestionMessage({
      questionNumber: currentSequence + 1,
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
}
