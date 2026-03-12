import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { participants, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const addParticipantSchema = z.object({
  slackUserId: z.string().min(1, "Slack user ID is required"),
  name: z.string().min(1, "Name is required"),
  title: z.string().optional(),
  role: z.enum(["editor", "interviewee", "reviewer"]).default("interviewee"),
  context: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const projectParticipants = await db.query.participants.findMany({
    where: eq(participants.projectId, id),
    orderBy: (participants, { asc }) => [asc(participants.createdAt)],
  });

  return NextResponse.json(projectParticipants);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // Verify project exists
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = addParticipantSchema.parse(body);

    // Check for duplicate participant in this project
    const existing = await db.query.participants.findFirst({
      where: and(
        eq(participants.projectId, id),
        eq(participants.slackUserId, data.slackUserId)
      ),
    });
    if (existing) {
      return NextResponse.json(
        { error: "This person is already a participant in this project" },
        { status: 409 }
      );
    }

    const [participant] = await db
      .insert(participants)
      .values({
        projectId: id,
        slackUserId: data.slackUserId,
        name: data.name,
        title: data.title,
        role: data.role,
        context: data.context,
        status: "pending",
      })
      .returning();

    return NextResponse.json(participant, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Failed to add participant:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
