import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  thesis: z.string().optional(),
  targetAudience: z.string().optional(),
  targetWordCount: z.number().int().positive().optional(),
  status: z
    .enum(["setup", "interviewing", "compiling", "review", "published"])
    .optional(),
  approvalMode: z
    .enum(["auto", "editor_approves_all", "full_auto"])
    .optional(),
  maxRounds: z.number().int().positive().optional(),
  nudgeAfterHours: z.number().int().positive().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = await request.json();
    const data = updateProjectSchema.parse(body);

    const [updated] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Project not found" },
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
    console.error("Failed to update project:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const [deleted] = await db
    .delete(projects)
    .where(eq(projects.id, id))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
