import type { App } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import { db } from "@/db";
import { participants, exchanges, questions, projects, quoteApprovals } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { questionSendingQueue, nudgeQueue } from "@/jobs/queue";
import { buildQuoteReviewCompleteNotification } from "./messages";

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

  // Quote approval — participant approves a quote
  app.action("approve_quote", async ({ ack, body, client }) => {
    await ack();

    if (body.type !== "block_actions" || !body.actions?.[0]) return;
    const quoteApprovalId = body.actions[0].type === "button" ? body.actions[0].value : undefined;
    if (!quoteApprovalId) return;

    await db
      .update(quoteApprovals)
      .set({ status: "approved", reviewedAt: new Date() })
      .where(eq(quoteApprovals.id, quoteApprovalId));

    if ("channel" in body && body.channel && "message" in body && body.message) {
      // Update just the action block to show the result
      const blockId = `quote_review_${quoteApprovalId}`;
      const updatedBlocks = (body.message.blocks || []).map((block: any) => {
        if (block.block_id === blockId) {
          return {
            type: "context",
            block_id: blockId,
            elements: [{ type: "mrkdwn", text: ":white_check_mark: *Approved* — thanks!" }],
          };
        }
        return block;
      });

      try {
        await client.chat.update({
          channel: body.channel.id,
          ts: body.message.ts,
          blocks: updatedBlocks,
          text: "Quote approved",
        });
      } catch (err) {
        console.error("Failed to update quote approval message:", err);
      }
    }

    await checkAndNotifyQuoteReviewComplete(quoteApprovalId, client);
  });

  // Quote rejection — participant rejects a quote
  app.action("reject_quote", async ({ ack, body, client }) => {
    await ack();

    if (body.type !== "block_actions" || !body.actions?.[0]) return;
    const quoteApprovalId = body.actions[0].type === "button" ? body.actions[0].value : undefined;
    if (!quoteApprovalId) return;

    await db
      .update(quoteApprovals)
      .set({ status: "rejected", reviewedAt: new Date() })
      .where(eq(quoteApprovals.id, quoteApprovalId));

    if ("channel" in body && body.channel && "message" in body && body.message) {
      const blockId = `quote_review_${quoteApprovalId}`;
      const updatedBlocks = (body.message.blocks || []).map((block: any) => {
        if (block.block_id === blockId) {
          return {
            type: "context",
            block_id: blockId,
            elements: [{ type: "mrkdwn", text: ":x: *Rejected* — this quote won't be used." }],
          };
        }
        return block;
      });

      try {
        await client.chat.update({
          channel: body.channel.id,
          ts: body.message.ts,
          blocks: updatedBlocks,
          text: "Quote rejected",
        });
      } catch (err) {
        console.error("Failed to update quote rejection message:", err);
      }
    }

    await checkAndNotifyQuoteReviewComplete(quoteApprovalId, client);
  });

  // Quote edit suggestion — participant wants to suggest changes
  app.action("suggest_quote_edit", async ({ ack, body, client }) => {
    await ack();

    if (body.type !== "block_actions" || !body.actions?.[0]) return;
    const quoteApprovalId = body.actions[0].type === "button" ? body.actions[0].value : undefined;
    if (!quoteApprovalId) return;

    // Open a modal for the participant to suggest their edit
    if ("trigger_id" in body && body.trigger_id) {
      try {
        await client.views.open({
          trigger_id: body.trigger_id,
          view: {
            type: "modal",
            callback_id: "quote_edit_modal",
            private_metadata: quoteApprovalId,
            title: { type: "plain_text", text: "Suggest an edit" },
            submit: { type: "plain_text", text: "Submit" },
            close: { type: "plain_text", text: "Cancel" },
            blocks: [
              {
                type: "input",
                block_id: "suggested_text",
                label: { type: "plain_text", text: "How would you phrase this?" },
                element: {
                  type: "plain_text_input",
                  action_id: "suggested_text_input",
                  multiline: true,
                  placeholder: {
                    type: "plain_text",
                    text: "Type your preferred version of the quote here...",
                  },
                },
              },
            ],
          },
        });
      } catch (err) {
        console.error("Failed to open quote edit modal:", err);
      }
    }
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

  // Modal submission for quote edit suggestions
  app.view("quote_edit_modal", async ({ ack, view, client }) => {
    await ack();

    const quoteApprovalId = view.private_metadata;
    const suggestedText =
      view.state.values.suggested_text?.suggested_text_input?.value || "";

    if (!quoteApprovalId || !suggestedText) return;

    await db
      .update(quoteApprovals)
      .set({
        status: "edit_suggested",
        suggestedEdit: suggestedText,
        reviewedAt: new Date(),
      })
      .where(eq(quoteApprovals.id, quoteApprovalId));

    await checkAndNotifyQuoteReviewComplete(quoteApprovalId, client);
  });
}

/**
 * Check if all quotes for a participant in a draft have been reviewed.
 * If so, notify the editor with a summary.
 */
async function checkAndNotifyQuoteReviewComplete(
  quoteApprovalId: string,
  client: WebClient
): Promise<void> {
  try {
    const approval = await db.query.quoteApprovals.findFirst({
      where: eq(quoteApprovals.id, quoteApprovalId),
    });
    if (!approval) return;

    // Check if all quotes for this participant + draft are reviewed
    const allQuotesForParticipant = await db.query.quoteApprovals.findMany({
      where: and(
        eq(quoteApprovals.draftId, approval.draftId),
        eq(quoteApprovals.participantId, approval.participantId)
      ),
    });

    const allReviewed = allQuotesForParticipant.every(
      (q) => q.status !== "pending"
    );
    if (!allReviewed) return;

    // All reviewed — notify the editor
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, approval.projectId),
    });
    if (!project) return;

    const participant = await db.query.participants.findFirst({
      where: eq(participants.id, approval.participantId),
    });
    if (!participant) return;

    const approved = allQuotesForParticipant.filter(
      (q) => q.status === "approved"
    ).length;
    const rejected = allQuotesForParticipant.filter(
      (q) => q.status === "rejected"
    ).length;
    const edited = allQuotesForParticipant.filter(
      (q) => q.status === "edit_suggested"
    ).length;

    const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/projects/${project.id}/draft`;

    const editorDm = await client.conversations.open({
      users: project.editorSlackUserId,
    });
    if (!editorDm.channel?.id) return;

    const blocks = buildQuoteReviewCompleteNotification({
      participantName: participant.name,
      projectTitle: project.title,
      approved,
      rejected,
      edited,
      dashboardUrl,
    });

    await client.chat.postMessage({
      channel: editorDm.channel.id,
      blocks,
      text: `${participant.name} finished reviewing quotes for "${project.title}"`,
    });
  } catch (err) {
    console.error("Failed to check/notify quote review completion:", err);
  }
}
