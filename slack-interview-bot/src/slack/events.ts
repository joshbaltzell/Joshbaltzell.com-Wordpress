import type { App } from "@slack/bolt";
import { db } from "@/db";
import { exchanges, participants } from "@/db/schema";
import { eq, and } from "drizzle-orm";

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

    const slackUserId = event.user;
    const messageText = "text" in event ? event.text : undefined;

    if (!slackUserId || !messageText) return;

    // Find the participant and their pending/sent exchange
    const participant = await db.query.participants.findFirst({
      where: and(
        eq(participants.slackUserId, slackUserId),
        eq(participants.status, "active")
      ),
    });

    if (!participant) {
      // Not a known participant — ignore or send a polite response
      await client.chat.postMessage({
        channel: event.channel,
        text: "Hi! I'm an interview bot. If you've been invited to participate in an interview, I'll reach out to you directly.",
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
        channel: event.channel,
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

    // Acknowledge receipt
    await client.reactions.add({
      channel: event.channel,
      name: "white_check_mark",
      timestamp: event.ts,
    });

    // TODO: Enqueue background jobs:
    // 1. Follow-up question generation
    // 2. Cross-pollination check
    // 3. Saturation check (if every 5th exchange)
    // 4. Send next question (after delay)
    // 5. Notify editor

    await client.chat.postMessage({
      channel: event.channel,
      text: "Got it — great answer! I'll follow up with the next question soon.",
    });
  });
}
