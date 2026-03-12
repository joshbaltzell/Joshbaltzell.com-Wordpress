import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  projects,
  participants,
  exchanges,
  questions,
  drafts,
  draftQuoteRefs,
} from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { compileDraft } from "@/ai/compiler";
import type { FormattedExchange } from "@/lib/types";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Compile all exchanges into a draft article.
 * Runs the 3-pass compilation: extraction → assembly → audit.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Load all answered exchanges with participant and question data
  const answeredExchanges = await db
    .select({
      id: exchanges.id,
      participantId: exchanges.participantId,
      participantName: participants.name,
      participantTitle: participants.title,
      questionText: questions.text,
      answerText: exchanges.answerText,
      sequence: exchanges.sequence,
      answeredAt: exchanges.answeredAt,
    })
    .from(exchanges)
    .innerJoin(participants, eq(exchanges.participantId, participants.id))
    .innerJoin(questions, eq(exchanges.questionId, questions.id))
    .where(
      and(eq(exchanges.projectId, id), eq(exchanges.status, "answered"))
    )
    .orderBy(exchanges.answeredAt);

  if (answeredExchanges.length === 0) {
    return NextResponse.json(
      { error: "No answered exchanges to compile" },
      { status: 400 }
    );
  }

  const formatted: FormattedExchange[] = answeredExchanges.map((ex) => ({
    exchangeId: ex.id,
    participantName: ex.participantName,
    participantTitle: ex.participantTitle || "",
    question: ex.questionText,
    answer: ex.answerText || "",
    sequence: ex.sequence,
    answeredAt: ex.answeredAt?.toISOString() || "",
  }));

  // Run the 3-pass compilation
  const result = await compileDraft({
    title: project.title,
    thesis: project.thesis || project.title,
    audience: project.targetAudience || "",
    targetWordCount: project.targetWordCount || 1500,
    allExchanges: formatted,
  });

  // Determine draft version
  const [versionCount] = await db
    .select({ count: count() })
    .from(drafts)
    .where(eq(drafts.projectId, id));
  const version = (versionCount?.count ?? 0) + 1;

  // Store the draft
  const [draft] = await db
    .insert(drafts)
    .values({
      projectId: id,
      version,
      title: result.title,
      body: result.body,
      thematicAnalysis: result.thematicAnalysis as any,
      modelUsed: result.modelUsed,
    })
    .returning();

  // Parse [QUOTE_ID:xxx] markers and create quote refs
  const quotePattern = /\[QUOTE_ID:([^\]]+)\]/g;
  let match;
  while ((match = quotePattern.exec(result.body)) !== null) {
    const exchangeId = match[1];
    const sourceExchange = formatted.find((e) => e.exchangeId === exchangeId);
    if (sourceExchange) {
      // Extract the quote text that precedes the marker (rough heuristic)
      const beforeMarker = result.body.substring(0, match.index);
      const lastQuote = beforeMarker.match(/"([^"]+)"\s*$/);

      await db.insert(draftQuoteRefs).values({
        draftId: draft.id,
        exchangeId,
        quoteSnippet: lastQuote?.[1] || sourceExchange.answer.substring(0, 200),
        locationHint: `Near character position ${match.index}`,
      });
    }
  }

  // Update project status
  await db
    .update(projects)
    .set({ status: "review", updatedAt: new Date() })
    .where(eq(projects.id, id));

  return NextResponse.json({
    draft,
    mismatches: result.mismatches,
    quoteCount: (result.body.match(/\[QUOTE_ID:/g) || []).length,
  });
}
