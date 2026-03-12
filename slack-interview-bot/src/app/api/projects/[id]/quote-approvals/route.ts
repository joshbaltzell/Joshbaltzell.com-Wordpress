import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  projects,
  drafts,
  draftQuoteRefs,
  quoteApprovals,
  participants,
  exchanges,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSlackApp } from "@/slack/app";
import { buildQuoteApprovalMessage } from "@/slack/messages";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/:id/quote-approvals
 * List all quote approvals for a project.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const approvals = await db.query.quoteApprovals.findMany({
    where: eq(quoteApprovals.projectId, id),
  });

  return NextResponse.json(approvals);
}

/**
 * POST /api/projects/:id/quote-approvals
 * Send quote approval requests to all participants for the latest draft.
 * Extracts quotes from the draft, detects paraphrases, creates approval records,
 * and sends Slack DMs to each participant with their quotes for review.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Get the latest draft
  const latestDraft = await db.query.drafts.findFirst({
    where: eq(drafts.projectId, id),
    orderBy: [desc(drafts.version)],
  });
  if (!latestDraft) {
    return NextResponse.json(
      { error: "No draft found — compile the article first" },
      { status: 400 }
    );
  }

  // Get all quote refs for this draft
  const quoteRefs = await db.query.draftQuoteRefs.findMany({
    where: eq(draftQuoteRefs.draftId, latestDraft.id),
  });
  if (quoteRefs.length === 0) {
    return NextResponse.json(
      { error: "No quotes found in draft" },
      { status: 400 }
    );
  }

  // Load exchange data for each quote ref
  const quotesWithContext: Array<{
    ref: typeof quoteRefs[0];
    exchange: { id: string; participantId: string; answerText: string | null };
    participant: { id: string; name: string; dmChannelId: string | null; slackUserId: string };
  }> = [];

  for (const ref of quoteRefs) {
    if (ref.editorExcluded) continue;

    const exchange = await db.query.exchanges.findFirst({
      where: eq(exchanges.id, ref.exchangeId),
    });
    if (!exchange || !exchange.answerText) continue;

    const participant = await db.query.participants.findFirst({
      where: eq(participants.id, exchange.participantId),
    });
    if (!participant) continue;

    quotesWithContext.push({
      ref,
      exchange: {
        id: exchange.id,
        participantId: exchange.participantId,
        answerText: exchange.answerText,
      },
      participant: {
        id: participant.id,
        name: participant.name,
        dmChannelId: participant.dmChannelId,
        slackUserId: participant.slackUserId,
      },
    });
  }

  // Group by participant
  const byParticipant = new Map<
    string,
    typeof quotesWithContext
  >();
  for (const item of quotesWithContext) {
    const existing = byParticipant.get(item.participant.id) || [];
    existing.push(item);
    byParticipant.set(item.participant.id, existing);
  }

  const app = getSlackApp();
  let totalSent = 0;

  for (const [participantId, items] of byParticipant) {
    const participant = items[0].participant;

    // Create approval records
    const approvalRecords: Array<{
      quoteApprovalId: string;
      quoteText: string;
      context: string;
      isParaphrased: boolean;
    }> = [];

    for (const item of items) {
      const quoteText = item.ref.quoteSnippet;
      const originalText = item.exchange.answerText || "";

      // Detect paraphrasing: check if the quote appears verbatim in the original
      const isParaphrased = !originalText.includes(quoteText);

      const [approval] = await db
        .insert(quoteApprovals)
        .values({
          draftId: latestDraft.id,
          exchangeId: item.exchange.id,
          participantId,
          projectId: id,
          quoteText,
          originalText,
          isParaphrased,
          contextInArticle: item.ref.locationHint || "",
        })
        .returning();

      approvalRecords.push({
        quoteApprovalId: approval.id,
        quoteText,
        context: item.ref.locationHint || "Used in the article",
        isParaphrased,
      });
    }

    // Send Slack DM
    try {
      let channelId = participant.dmChannelId;
      if (!channelId) {
        const dm = await app.client.conversations.open({
          users: participant.slackUserId,
        });
        channelId = dm.channel?.id || null;
      }

      if (channelId) {
        // Find editor name
        const editorInfo = await app.client.users.info({
          user: project.editorSlackUserId,
        });
        const editorName =
          editorInfo.user?.real_name || editorInfo.user?.name || "the editor";

        const blocks = buildQuoteApprovalMessage({
          participantName: participant.name,
          projectTitle: project.title,
          editorName,
          quotes: approvalRecords,
        });

        const result = await app.client.chat.postMessage({
          channel: channelId,
          blocks,
          text: `Please review your quotes for "${project.title}"`,
        });

        // Store the message TS for potential updates
        if (result.ts) {
          for (const record of approvalRecords) {
            await db
              .update(quoteApprovals)
              .set({ slackMessageTs: result.ts })
              .where(eq(quoteApprovals.id, record.quoteApprovalId));
          }
        }

        totalSent += approvalRecords.length;
      }
    } catch (err) {
      console.error(
        `Failed to send quote approval to ${participant.name}:`,
        err
      );
    }
  }

  return NextResponse.json({
    success: true,
    totalQuotesSent: totalSent,
    participantsContacted: byParticipant.size,
  });
}
