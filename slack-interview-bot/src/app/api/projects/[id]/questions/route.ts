import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const addQuestionSchema = z.object({
  text: z.string().min(1, "Question text is required"),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
});

const approveQuestionSchema = z.object({
  questionId: z.string().uuid(),
  approved: z.boolean(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const projectQuestions = await db.query.questions.findMany({
    where: eq(questions.projectId, id),
    orderBy: (questions, { desc }) => [desc(questions.createdAt)],
  });

  return NextResponse.json(projectQuestions);
}

/** Add a manual question to the project */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = addQuestionSchema.parse(body);

    const [question] = await db
      .insert(questions)
      .values({
        projectId: id,
        text: data.text,
        origin: "manual",
        priority: data.priority,
        approved: true,
      })
      .returning();

    return NextResponse.json(question, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Failed to add question:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/** Approve or reject an AI-generated question */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json();
    const data = approveQuestionSchema.parse(body);

    const [updated] = await db
      .update(questions)
      .set({ approved: data.approved })
      .where(eq(questions.id, data.questionId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Failed to update question:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
