import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  projects,
  participants,
  questions,
  exchanges,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSlackApp } from "@/slack/app";
import { buildOutreachMessage, buildQuestionMessage } from "@/slack/messages";
import { generateSeedQuestions } from "@/slack/seed-questions";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Start interviewing — sends outreach messages to all pending participants.
 *
 * Flow:
 * 1. Generate seed questions for each participant (if none exist)
 * 2. Open DM channels with each participant
 * 3. Send outreach message with "Let's go" / "Decline" buttons
 * 4. Update project status to "interviewing"
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.status !== "setup") {
    return NextResponse.json(
      { error: "Project is already started" },
      { status: 400 }
    );
  }

  // Get participants eligible for outreach (skip declined)
  const pendingParticipants = await db.query.participants.findMany({
    where: and(
      eq(participants.projectId, id),
      eq(participants.role, "interviewee"),
      eq(participants.status, "pending")
    ),
  });

  if (pendingParticipants.length === 0) {
    return NextResponse.json(
      { error: "Add at least one participant before starting" },
      { status: 400 }
    );
  }

  // Check if seed questions already exist
  const existingQuestions = await db.query.questions.findMany({
    where: eq(questions.projectId, id),
  });

  // Generate seed questions for participants that don't have any
  if (existingQuestions.length === 0) {
    for (const participant of pendingParticipants) {
      try {
        const seedQuestions = await generateSeedQuestions({
          thesis: project.thesis || project.title,
          audience: project.targetAudience || "",
          participantName: participant.name,
          participantTitle: participant.title || "",
          participantContext: participant.context || "",
          questionCount: Math.min(project.maxRounds || 10, 5),
        });

        if (seedQuestions.length === 0) {
          return NextResponse.json(
            { error: `Failed to generate seed questions for ${participant.name}. Check your Gemini API key.` },
            { status: 500 }
          );
        }

        for (const questionText of seedQuestions) {
          await db.insert(questions).values({
            projectId: id,
            text: questionText,
            origin: "manual",
            priority: "high",
            approved: true,
          });
        }
      } catch (err: any) {
        console.error(`Seed question generation failed for ${participant.name}:`, err);
        return NextResponse.json(
          { error: `Failed to generate questions: ${err.message}` },
          { status: 500 }
        );
      }
    }
  }

  const app = getSlackApp();
  const results: Array<{ participantId: string; success: boolean; error?: string }> = [];

  // Send outreach to each participant
  for (const participant of pendingParticipants) {
    try {
      // Open a DM channel
      const dmResult = await app.client.conversations.open({
        users: participant.slackUserId,
      });

      const channelId = dmResult.channel?.id;
      if (!channelId) {
        results.push({
          participantId: participant.id,
          success: false,
          error: "Could not open DM channel",
        });
        continue;
      }

      // Cache the DM channel ID
      await db
        .update(participants)
        .set({ dmChannelId: channelId })
        .where(eq(participants.id, participant.id));

      // Send outreach message
      await app.client.chat.postMessage({
        channel: channelId,
        text: `Hi ${participant.name}! I'm helping put together an article about "${project.title}".`,
        blocks: buildOutreachMessage({
          participantName: participant.name.split(" ")[0], // First name
          editorName: "the editor", // TODO: get from auth
          projectTitle: project.title,
          participantContext: participant.context || "your expertise in this area",
          estimatedQuestions: project.maxRounds || 10,
        }),
        metadata: {
          event_type: "interview_outreach",
          event_payload: {
            project_id: id,
            participant_id: participant.id,
          },
        },
      });

      results.push({ participantId: participant.id, success: true });
    } catch (err: any) {
      console.error(
        `Failed to contact participant ${participant.name}:`,
        err.message
      );
      results.push({
        participantId: participant.id,
        success: false,
        error: err.message,
      });
    }
  }

  // Update project status
  await db
    .update(projects)
    .set({ status: "interviewing", updatedAt: new Date() })
    .where(eq(projects.id, id));

  return NextResponse.json({
    success: true,
    results,
    started: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  });
}
