import type { Job } from "bullmq";
import { db } from "@/db";
import { exchanges, participants, projects, questions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateFollowUps } from "@/ai/followup";
import { checkSaturation } from "@/ai/saturation";
import type { AnswerProcessingJob } from "./queue";
import type { FormattedExchange } from "@/lib/types";

/**
 * Process a newly received answer:
 * 1. Generate follow-up questions
 * 2. Check for cross-pollination opportunities
 * 3. Run saturation check (every 5 exchanges)
 * 4. Queue next question for sending
 * 5. Notify editor
 */
export async function processAnswer(
  job: Job<AnswerProcessingJob>
): Promise<void> {
  const { exchangeId, projectId, participantId } = job.data;

  // Load context
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  const participant = await db.query.participants.findFirst({
    where: eq(participants.id, participantId),
  });
  const exchange = await db.query.exchanges.findFirst({
    where: eq(exchanges.id, exchangeId),
    with: { question: true },
  });

  if (!project || !participant || !exchange) {
    throw new Error(`Missing data for exchange ${exchangeId}`);
  }

  // Load all prior exchanges for this participant
  const priorExchanges = await db.query.exchanges.findMany({
    where: and(
      eq(exchanges.participantId, participantId),
      eq(exchanges.status, "answered")
    ),
    with: { question: true },
    orderBy: (exchanges, { asc }) => [asc(exchanges.sequence)],
  });

  const formatted: FormattedExchange[] = priorExchanges.map((ex) => ({
    exchangeId: ex.id,
    participantName: participant.name,
    participantTitle: participant.title || "",
    question: (ex as any).question?.text || "",
    answer: ex.answerText || "",
    sequence: ex.sequence,
    answeredAt: ex.answeredAt?.toISOString() || "",
  }));

  // 1. Generate follow-up questions
  const followUps = await generateFollowUps({
    thesis: project.thesis || "",
    audience: project.targetAudience || "",
    participantName: participant.name,
    participantTitle: participant.title || "",
    participantContext: participant.context || "",
    priorExchanges: formatted,
    latestQuestion: (exchange as any).question?.text || "",
    latestAnswer: exchange.answerText || "",
  });

  // Store generated follow-ups as questions
  for (const followUp of followUps) {
    const autoApprove =
      project.approvalMode === "full_auto" ||
      (project.approvalMode === "auto" && followUp.priority === "high");

    await db.insert(questions).values({
      projectId,
      text: followUp.question,
      origin: "ai_followup",
      sourceExchangeId: exchangeId,
      priority: followUp.priority,
      approved: autoApprove,
    });
  }

  // 2. Count total answered exchanges for saturation check
  const allAnswered = await db.query.exchanges.findMany({
    where: and(
      eq(exchanges.projectId, projectId),
      eq(exchanges.status, "answered")
    ),
  });

  // Run saturation check every 5 exchanges
  if (allAnswered.length % 5 === 0 && allAnswered.length >= 5) {
    // Load all participants for formatting
    const allParticipants = await db.query.participants.findMany({
      where: eq(participants.projectId, projectId),
    });

    const participantMap = new Map(
      allParticipants.map((p) => [p.id, p])
    );

    const allFormatted: FormattedExchange[] = [];
    for (const ex of allAnswered) {
      const p = participantMap.get(ex.participantId);
      const q = await db.query.questions.findFirst({
        where: eq(questions.id, ex.questionId),
      });
      if (p && q) {
        allFormatted.push({
          exchangeId: ex.id,
          participantName: p.name,
          participantTitle: p.title || "",
          question: q.text,
          answer: ex.answerText || "",
          sequence: ex.sequence,
          answeredAt: ex.answeredAt?.toISOString() || "",
        });
      }
    }

    const saturation = await checkSaturation({
      thesis: project.thesis || "",
      targetWordCount: project.targetWordCount || 1500,
      audience: project.targetAudience || "",
      allExchanges: allFormatted,
    });

    // Store saturation report in project settings
    await db
      .update(projects)
      .set({
        settings: {
          ...(project.settings || {}),
          latestSaturation: saturation,
        },
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    // If ready to draft, update project status
    if (saturation.readyToDraft) {
      await db
        .update(projects)
        .set({ status: "compiling", updatedAt: new Date() })
        .where(eq(projects.id, projectId));
    }
  }

  // 3. TODO: Cross-pollination check
  // 4. TODO: Queue next question for this participant
  // 5. TODO: Notify editor via Slack DM
}
