import type { App } from "@slack/bolt";
import { db } from "@/db";
import { exchanges, participants, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { answerProcessingQueue, questionSendingQueue } from "@/jobs/queue";
import { buildEditorNotification } from "./messages";

/**
 * Register Slack event handlers.
 * The primary event is message.im — when a participant replies to a question.
 */
export function registerEvents(app: App): void {
  // Handle DM messages from participants
  app.event("message", async ({ event, client }) => {
    // Only handle direct messages (not bot messages, not edits)
    if (
      event.channel_type !== "im" ||
      "bot_id" in event ||
      "subtype" in event
    ) {
      return;
    }

    // After the guards above, TS narrows to `never`. Use a runtime alias.
    const msg = event as { user?: string; text?: string; channel: string; ts: string };
    const slackUserId = msg.user;
    const messageText = msg.text;

    if (!slackUserId || !messageText) return;

    // Find the participant and their pending/sent exchange
    const participant = await db.query.participants.findFirst({
      where: and(
        eq(participants.slackUserId, slackUserId),
        eq(participants.status, "active")
      ),
    });

    if (!participant) {
      await client.chat.postMessage({
        channel: msg.channel,
        text: "Hey! I'm Quotable :speech_balloon: — I help collect great quotes for articles. If you've been invited to participate in an interview, I'll reach out to you directly.",
      });
      return;
    }

    // Find the most recent sent (unanswered) exchange for this participant
    const pendingExchange = await db.query.exchanges.findFirst({
      where: and(
        eq(exchanges.participantId, participant.id),
        eq(exchanges.status, "sent")
      ),
      orderBy: (exchanges, { desc }) => [desc(exchanges.sequence)],
    });

    if (!pendingExchange) {
      await client.chat.postMessage({
        channel: msg.channel,
        text: "Thanks for the message! I don't have a pending question for you right now. I'll follow up when the next one is ready.",
      });
      return;
    }

    // Store the answer
    await db
      .update(exchanges)
      .set({
        answerText: messageText,
        status: "answered",
        answeredAt: new Date(),
      })
      .where(eq(exchanges.id, pendingExchange.id));

    // Acknowledge receipt (non-critical — don't fail the handler if this errors)
    try {
      await client.reactions.add({
        channel: msg.channel,
        name: "white_check_mark",
        timestamp: msg.ts,
      });
    } catch (err) {
      console.warn("Failed to add reaction to message:", err);
    }

    // Enqueue answer processing (follow-ups, cross-poll, saturation)
    await answerProcessingQueue.add(
      `process-${pendingExchange.id}`,
      {
        exchangeId: pendingExchange.id,
        projectId: pendingExchange.projectId,
        participantId: participant.id,
      },
      { delay: 1000 } // Small delay to let DB writes settle
    );

    // Enqueue next question sending (with a human-like delay)
    await questionSendingQueue.add(
      `next-question-${participant.id}`,
      {
        exchangeId: pendingExchange.id,
        participantId: participant.id,
      },
      { delay: 30_000 } // 30 second delay before next question
    );

    // Notify editor
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, pendingExchange.projectId),
    });
    if (project) {
      try {
        const editorDm = await client.conversations.open({
          users: project.editorSlackUserId,
        });
        if (editorDm.channel?.id) {
          const answerPreview =
            messageText.length > 200
              ? messageText.substring(0, 200) + "..."
              : messageText;

          await client.chat.postMessage({
            channel: editorDm.channel.id,
            text: `${participant.name} answered a question on "${project.title}"`,
            blocks: buildEditorNotification({
              projectTitle: project.title,
              participantName: participant.name,
              questionNumber: pendingExchange.sequence,
              answerPreview,
              followUpCount: 0, // Will be updated after processing
              crossPollCount: 0,
              dashboardUrl: `${process.env.APP_URL || "http://localhost:3000"}/projects/${project.id}`,
            }),
          });
        }
      } catch (err) {
        console.error("Failed to notify editor:", err);
      }
    }

    await client.chat.postMessage({
      channel: msg.channel,
      text: "Got it — great answer! I'll follow up with the next question soon.",
    });
  });
}
