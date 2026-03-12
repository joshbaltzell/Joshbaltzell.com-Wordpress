import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { exchanges, participants, questions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // Get all exchanges for this project with participant and question data
  const projectExchanges = await db
    .select({
      id: exchanges.id,
      participantId: exchanges.participantId,
      participantName: participants.name,
      participantTitle: participants.title,
      questionText: questions.text,
      questionOrigin: questions.origin,
      answerText: exchanges.answerText,
      sequence: exchanges.sequence,
      status: exchanges.status,
      askedAt: exchanges.askedAt,
      answeredAt: exchanges.answeredAt,
    })
    .from(exchanges)
    .innerJoin(participants, eq(exchanges.participantId, participants.id))
    .innerJoin(questions, eq(exchanges.questionId, questions.id))
    .where(eq(exchanges.projectId, id))
    .orderBy(exchanges.answeredAt);

  return NextResponse.json(projectExchanges);
}
