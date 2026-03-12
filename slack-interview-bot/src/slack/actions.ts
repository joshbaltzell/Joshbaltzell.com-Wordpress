import type { App } from "@slack/bolt";
import { db } from "@/db";
import { participants, exchanges, questions, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { questionSendingQueue, nudgeQueue } from "@/jobs/queue";

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

    // Find and activate the participant
    const participant = await db.query.participants.findFirst({
      where: and(
        eq(participants.slackUserId, slackUserId),
        eq(participants.status, "pending")
      ),
    });

    if (!participant) return;

    await db
      .update(participants)
      .set({ status: "active" })
      .where(eq(participants.id, participant.id));

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

    // Send the first question after a short delay
    await questionSendingQueue.add(
      `first-question-${participant.id}`,
      {
        exchangeId: "", // No prior exchange — this is the first question
        participantId: participant.id,
      },
      { delay: 3000 }
    );
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

    // Find the participant and schedule a nudge
    if (body.user) {
      const participant = await db.query.participants.findFirst({
        where: eq(participants.slackUserId, body.user.id),
      });
      if (participant) {
        await nudgeQueue.add(
          `delay-nudge-${participant.id}`,
          {
            participantId: participant.id,
            exchangeId: "", // No exchange yet — this nudge re-sends the outreach
            projectId: participant.projectId,
          },
          { delay: 48 * 60 * 60 * 1000 } // 48 hours
        );
      }
    }
  });

  // Participant declines
  app.action("participant_decline", async ({ ack, body, client }) => {
    await ack();

    if (body.type !== "block_actions" || !body.user) return;

    const slackUserId = body.user.id;

    // Find the participant to get their project for editor notification
    const participant = await db.query.participants.findFirst({
      where: eq(participants.slackUserId, slackUserId),
    });

    await db
      .update(participants)
      .set({ status: "declined" })
      .where(eq(participants.slackUserId, slackUserId));

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

    // Notify editor
    if (participant) {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, participant.projectId),
      });
      if (project) {
        try {
          const editorDm = await client.conversations.open({
            users: project.editorSlackUserId,
          });
          if (editorDm.channel?.id) {
            await client.chat.postMessage({
              channel: editorDm.channel.id,
              text: `${participant.name} declined the interview for "${project.title}". You may want to add a replacement participant.`,
            });
          }
        } catch (err) {
          console.error("Failed to notify editor of decline:", err);
        }
      }
    }
  });

  // Skip a question
  app.action("skip_question", async ({ ack, body, client }) => {
    await ack();

    if (body.type !== "block_actions" || !body.user) return;

    const slackUserId = body.user.id;

    // Find the participant's pending exchange
    const participant = await db.query.participants.findFirst({
      where: and(
        eq(participants.slackUserId, slackUserId),
        eq(participants.status, "active")
      ),
    });

    if (participant) {
      // Mark the current sent exchange as skipped
      const pendingExchange = await db.query.exchanges.findFirst({
        where: and(
          eq(exchanges.participantId, participant.id),
          eq(exchanges.status, "sent")
        ),
        orderBy: (e, { desc }) => [desc(e.sequence)],
      });

      if (pendingExchange) {
        await db
          .update(exchanges)
          .set({ status: "skipped", answeredAt: new Date() })
          .where(eq(exchanges.id, pendingExchange.id));
      }

      // Queue next question
      await questionSendingQueue.add(
        `skip-next-${participant.id}`,
        {
          exchangeId: pendingExchange?.id || "",
          participantId: participant.id,
        },
        { delay: 5000 }
      );
    }

    if ("channel" in body && body.channel) {
      await client.chat.postMessage({
        channel: body.channel.id,
        text: "No problem, skipping that one. Next question coming up shortly.",
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

    if (body.type !== "block_actions" || !body.user) return;

    const slackUserId = body.user.id;

    const participant = await db.query.participants.findFirst({
      where: and(
        eq(participants.slackUserId, slackUserId),
        eq(participants.status, "active")
      ),
    });

    if (participant) {
      // Mark current exchange as skipped
      const pendingExchange = await db.query.exchanges.findFirst({
        where: and(
          eq(exchanges.participantId, participant.id),
          eq(exchanges.status, "sent")
        ),
        orderBy: (e, { desc }) => [desc(e.sequence)],
      });

      if (pendingExchange) {
        await db
          .update(exchanges)
          .set({ status: "skipped", answeredAt: new Date() })
          .where(eq(exchanges.id, pendingExchange.id));
      }

      // Queue a different question
      await questionSendingQueue.add(
        `different-question-${participant.id}`,
        {
          exchangeId: pendingExchange?.id || "",
          participantId: participant.id,
        },
        { delay: 3000 }
      );
    }

    if ("channel" in body && body.channel) {
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

    const slackUserId = body.user.id;

    const participant = await db.query.participants.findFirst({
      where: eq(participants.slackUserId, slackUserId),
    });

    // Mark any pending exchanges as skipped
    if (participant) {
      await db
        .update(exchanges)
        .set({ status: "skipped" })
        .where(
          and(
            eq(exchanges.participantId, participant.id),
            eq(exchanges.status, "sent")
          )
        );
    }

    await db
      .update(participants)
      .set({ status: "completed" })
      .where(eq(participants.slackUserId, slackUserId));

    if ("channel" in body && body.channel) {
      await client.chat.postMessage({
        channel: body.channel.id,
        text: "Thanks for your time — your answers have been really helpful! The editor will be in touch when the article comes together.",
      });
    }

    // Notify editor
    if (participant) {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, participant.projectId),
      });
      if (project) {
        try {
          const editorDm = await client.conversations.open({
            users: project.editorSlackUserId,
          });
          if (editorDm.channel?.id) {
            await client.chat.postMessage({
              channel: editorDm.channel.id,
              text: `${participant.name} has finished their interview for "${project.title}".`,
            });
          }
        } catch (err) {
          console.error("Failed to notify editor of completion:", err);
        }
      }
    }
  });

  // Dashboard link button (no-op, just opens URL)
  app.action("open_dashboard", async ({ ack }) => {
    await ack();
  });

  // Editor approves pending questions from Slack notification
  app.action("approve_pending_questions", async ({ ack, body, client }) => {
    await ack();

    // Approve all pending AI-generated questions for the editor's projects
    if (body.type === "block_actions" && body.user) {
      const editorProjects = await db.query.projects.findMany({
        where: eq(projects.editorSlackUserId, body.user.id),
      });

      let approvedCount = 0;
      for (const project of editorProjects) {
        const pending = await db.query.questions.findMany({
          where: and(
            eq(questions.projectId, project.id),
            eq(questions.approved, false)
          ),
        });

        for (const q of pending) {
          await db
            .update(questions)
            .set({ approved: true })
            .where(eq(questions.id, q.id));
          approvedCount++;
        }
      }

      if ("channel" in body && body.channel) {
        await client.chat.postMessage({
          channel: body.channel.id,
          text:
            approvedCount > 0
              ? `Approved ${approvedCount} pending question${approvedCount > 1 ? "s" : ""}! They'll be sent to participants soon.`
              : "No pending questions to approve right now.",
        });
      }
    }
  });
}
