import type { App } from "@slack/bolt";
import { db } from "@/db";
import { participants } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Register Block Kit interactive action handlers.
 * These handle button clicks in bot messages.
 */
export function registerActions(app: App): void {
  // Participant accepts interview invitation
  app.action("participant_accept", async ({ ack, body, client }) => {
    await ack();

    if (body.type !== "block_actions" || !body.user) return;

    const slackUserId = body.user.id;

    // Activate the participant
    await db
      .update(participants)
      .set({ status: "active" })
      .where(eq(participants.slackUserId, slackUserId));

    // Update the original message to remove buttons
    if ("channel" in body && body.channel && "message" in body && body.message) {
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: "You're in! First question coming up...",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "You're in! First question coming up...",
            },
          },
        ],
      });
    }

    // TODO: Enqueue job to send the first question
  });

  // Participant delays
  app.action("participant_delay", async ({ ack, body, client }) => {
    await ack();

    if (body.type !== "block_actions" || !("channel" in body) || !body.channel) return;

    if ("message" in body && body.message) {
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: "No problem! I'll check back in a couple of days.",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "No problem! I'll check back in a couple of days. Just message me when you're ready.",
            },
          },
        ],
      });
    }

    // TODO: Schedule a follow-up nudge
  });

  // Participant declines
  app.action("participant_decline", async ({ ack, body, client }) => {
    await ack();

    if (body.type !== "block_actions" || !body.user) return;

    await db
      .update(participants)
      .set({ status: "declined" })
      .where(eq(participants.slackUserId, body.user.id));

    if ("channel" in body && body.channel && "message" in body && body.message) {
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: "Understood — thanks for letting me know!",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Understood — thanks for letting me know! No worries at all.",
            },
          },
        ],
      });
    }

    // TODO: Notify editor that participant declined
  });

  // Skip a question
  app.action("skip_question", async ({ ack, body, client }) => {
    await ack();

    // TODO: Mark exchange as skipped, send next question
    if (body.type === "block_actions" && "channel" in body && body.channel) {
      await client.chat.postMessage({
        channel: body.channel.id,
        text: "No problem, skipping that one. I'll send the next question shortly.",
      });
    }
  });

  // Nudge — participant wants to answer now (just acknowledge)
  app.action("nudge_answer", async ({ ack }) => {
    await ack();
    // The original question is still pending — they just reply to it
  });

  // Nudge — ask a different question
  app.action("nudge_different_question", async ({ ack, body, client }) => {
    await ack();

    // TODO: Mark current exchange as skipped, generate a replacement question
    if (body.type === "block_actions" && "channel" in body && body.channel) {
      await client.chat.postMessage({
        channel: body.channel.id,
        text: "Sure thing! Let me come up with a different question for you.",
      });
    }
  });

  // Participant says they're done
  app.action("participant_complete", async ({ ack, body, client }) => {
    await ack();

    if (body.type !== "block_actions" || !body.user) return;

    await db
      .update(participants)
      .set({ status: "completed" })
      .where(eq(participants.slackUserId, body.user.id));

    if ("channel" in body && body.channel) {
      await client.chat.postMessage({
        channel: body.channel.id,
        text: "Thanks for your time — your answers have been really helpful! The editor will be in touch when the article comes together.",
      });
    }

    // TODO: Notify editor, check if all participants are done
  });

  // Dashboard link button (no-op, just opens URL)
  app.action("open_dashboard", async ({ ack }) => {
    await ack();
  });

  // Editor approves pending questions from Slack notification
  app.action("approve_pending_questions", async ({ ack, body, client }) => {
    await ack();

    // TODO: Approve all pending questions for this project and send them
    if (body.type === "block_actions" && "channel" in body && body.channel) {
      await client.chat.postMessage({
        channel: body.channel.id,
        text: "All pending questions approved and queued for sending!",
      });
    }
  });
}
