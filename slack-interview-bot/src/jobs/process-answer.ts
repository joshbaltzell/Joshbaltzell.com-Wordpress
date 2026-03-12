import type { Job } from "bullmq";
import { db } from "@/db";
import { exchanges, participants, projects, questions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateFollowUps } from "@/ai/followup";
import { generateCrossPollQuestions } from "@/ai/crosspoll";
import { checkSaturation } from "@/ai/saturation";
import type { AnswerProcessingJob } from "./queue";
import type { FormattedExchange } from "@/lib/types";

/**
 * Process a newly received answer:
 * 1. Generate follow-up questions
 * 2. Check for cross-pollination opportunities (if 3+ answers across participants)
 * 3. Run saturation check (every 5 exchanges)
 *
 * Note: Next question sending and editor notifications are handled by
 * the event handler in events.ts. This job focuses on AI intelligence.
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
  });

  if (!project || !participant || !exchange) {
    console.error(`Missing data for exchange ${exchangeId}: project=${!!project} participant=${!!participant} exchange=${!!exchange}`);
    return; // Don't retry — data is genuinely missing
  }

  // Load the question text separately (avoids unsafe `as any` casts)
  const exchangeQuestion = await db.query.questions.findFirst({
    where: eq(questions.id, exchange.questionId),
  });

  if (!exchangeQuestion) {
    console.error(`Missing question ${exchange.questionId} for exchange ${exchangeId}`);
    return;
  }

  // Load all prior answered exchanges for this participant
  const priorExchanges = await db.query.exchanges.findMany({
    where: and(
      eq(exchanges.participantId, participantId),
      eq(exchanges.status, "answered")
    ),
    orderBy: (e, { asc }) => [asc(e.sequence)],
  });

  const formatted: FormattedExchange[] = [];
  for (const ex of priorExchanges) {
    const q = await db.query.questions.findFirst({
      where: eq(questions.id, ex.questionId),
    });
    formatted.push({
      exchangeId: ex.id,
      participantName: participant.name,
      participantTitle: participant.title || "",
      question: q?.text || "",
      answer: ex.answerText || "",
      sequence: ex.sequence,
      answeredAt: ex.answeredAt?.toISOString() || "",
    });
  }

  // --- 1. Generate follow-up questions ---
  try {
    const followUps = await generateFollowUps({
      thesis: project.thesis || project.title,
      audience: project.targetAudience || "",
      participantName: participant.name,
      participantTitle: participant.title || "",
      participantContext: participant.context || "",
      priorExchanges: formatted,
      latestQuestion: exchangeQuestion.text,
      latestAnswer: exchange.answerText || "",
    });

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

    console.log(`Generated ${followUps.length} follow-up questions for ${participant.name}`);
  } catch (err) {
    console.error(`Follow-up generation failed for exchange ${exchangeId}:`, err);
    // Continue to cross-poll and saturation even if follow-ups fail
  }

  // --- 2. Cross-pollination (if enough data across participants) ---
  try {
    const allAnswered = await db.query.exchanges.findMany({
      where: and(
        eq(exchanges.projectId, projectId),
        eq(exchanges.status, "answered")
      ),
    });

    const allParticipants = await db.query.participants.findMany({
      where: and(
        eq(participants.projectId, projectId),
        eq(participants.role, "interviewee")
      ),
    });

    // Only cross-pollinate if we have answers from 2+ participants
    const answeredParticipantIds = new Set(allAnswered.map((e) => e.participantId));
    if (answeredParticipantIds.size >= 2 && allAnswered.length >= 3) {
      const participantMap = new Map(allParticipants.map((p) => [p.id, p]));

      // Build a simple theme summary from all exchanges
      const allFormattedForCrossPoll: string[] = [];
      for (const ex of allAnswered) {
        const p = participantMap.get(ex.participantId);
        const q = await db.query.questions.findFirst({
          where: eq(questions.id, ex.questionId),
        });
        if (p && q) {
          allFormattedForCrossPoll.push(
            `[${ex.id}] ${p.name} (${p.title || ""}): Q: ${q.text}\nA: "${ex.answerText}"`
          );
        }
      }

      const crossPolls = await generateCrossPollQuestions({
        thesis: project.thesis || project.title,
        allExchangesByTheme: allFormattedForCrossPoll.join("\n\n"),
        triggerParticipantName: participant.name,
        triggerThemes: `Topics from their latest answer: "${(exchange.answerText || "").substring(0, 200)}"`,
      });

      for (const cp of crossPolls) {
        // Verify the target participant exists and is active
        const targetParticipant = allParticipants.find((p) => p.id === cp.participantId);
        if (!targetParticipant || targetParticipant.status !== "active") continue;

        const autoApprove = project.approvalMode === "full_auto";

        await db.insert(questions).values({
          projectId,
          text: cp.question,
          origin: "ai_crosspoll",
          sourceExchangeId: exchangeId,
          sourceParticipantIds: [participantId],
          priority: "medium",
          approved: autoApprove,
        });
      }

      console.log(`Generated ${crossPolls.length} cross-pollination questions`);
    }
  } catch (err) {
    console.error(`Cross-pollination failed for exchange ${exchangeId}:`, err);
    // Continue to saturation check
  }

  // --- 3. Saturation check (every 5 answered exchanges) ---
  try {
    const allAnswered = await db.query.exchanges.findMany({
      where: and(
        eq(exchanges.projectId, projectId),
        eq(exchanges.status, "answered")
      ),
    });

    if (allAnswered.length >= 5 && allAnswered.length % 5 === 0) {
      const allParticipants = await db.query.participants.findMany({
        where: eq(participants.projectId, projectId),
      });
      const participantMap = new Map(allParticipants.map((p) => [p.id, p]));

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
        thesis: project.thesis || project.title,
        targetWordCount: project.targetWordCount || 1500,
        audience: project.targetAudience || "",
        allExchanges: allFormatted,
      });

      await db
        .update(projects)
        .set({
          settings: {
            ...((project.settings as Record<string, unknown>) || {}),
            latestSaturation: saturation,
            saturationCheckedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));

      if (saturation.readyToDraft) {
        await db
          .update(projects)
          .set({ status: "compiling", updatedAt: new Date() })
          .where(eq(projects.id, projectId));
        console.log(`Project ${project.title} is ready to draft (saturation passed)`);
      }
    }
  } catch (err) {
    console.error(`Saturation check failed for project ${projectId}:`, err);
  }
}
