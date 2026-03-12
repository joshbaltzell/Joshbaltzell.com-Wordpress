import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { z } from "zod";

const createProjectSchema = z.object({
  title: z.string().min(1, "Title is required"),
  thesis: z.string().optional(),
  targetAudience: z.string().optional(),
  targetWordCount: z.number().int().positive().default(1500),
  approvalMode: z
    .enum(["auto", "editor_approves_all", "full_auto"])
    .default("auto"),
  maxRounds: z.number().int().positive().default(10),
  nudgeAfterHours: z.number().int().positive().default(48),
  deadline: z.string().optional(),
  autoCompileOnDeadline: z.boolean().default(true),
  // These would normally come from auth — hardcoded for now
  editorSlackUserId: z.string().optional(),
  workspaceId: z.string().optional(),
});

export async function GET() {
  const allProjects = await db.query.projects.findMany({
    orderBy: (projects, { desc }) => [desc(projects.createdAt)],
  });
  return NextResponse.json(allProjects);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createProjectSchema.parse(body);

    const [project] = await db
      .insert(projects)
      .values({
        title: data.title,
        thesis: data.thesis,
        targetAudience: data.targetAudience,
        targetWordCount: data.targetWordCount,
        approvalMode: data.approvalMode,
        maxRounds: data.maxRounds,
        nudgeAfterHours: data.nudgeAfterHours,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        autoCompileOnDeadline: data.autoCompileOnDeadline,
        // TODO: Get from auth session
        editorSlackUserId: data.editorSlackUserId || "PLACEHOLDER",
        workspaceId: data.workspaceId || "PLACEHOLDER",
        status: "setup",
      })
      .returning();

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Failed to create project:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
