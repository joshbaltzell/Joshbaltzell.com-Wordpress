import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, participants, exchanges, drafts } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string }> };

export interface ProjectProgress {
  project: {
    id: string;
    title: string;
    status: string;
    deadline: string | null;
    daysRemaining: number | null;
    startedAt: string | null;
  };
  participants: Array<{
    id: string;
    name: string;
    status: string;
    answered: number;
    total: number;
  }>;
  totalAnswered: number;
  totalExchanges: number;
  completionPct: number;
  saturation: {
    scores: Record<string, number>;
    readyToDraft: boolean;
  } | null;
  latestDraftVersion: number | null;
}

/**
 * GET /api/projects/:id/progress
 * Returns a comprehensive progress summary for the project.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectParticipants = await db.query.participants.findMany({
    where: eq(participants.projectId, id),
  });

  const participantStats = await Promise.all(
    projectParticipants.map(async (p) => {
      const [answered] = await db
        .select({ count: count() })
        .from(exchanges)
        .where(
          and(eq(exchanges.participantId, p.id), eq(exchanges.status, "answered"))
        );
      const [total] = await db
        .select({ count: count() })
        .from(exchanges)
        .where(eq(exchanges.participantId, p.id));
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        answered: answered?.count ?? 0,
        total: total?.count ?? 0,
      };
    })
  );

  const totalAnswered = participantStats.reduce((sum, p) => sum + p.answered, 0);
  const totalExchanges = participantStats.reduce((sum, p) => sum + p.total, 0);
  const completionPct =
    totalExchanges > 0 ? Math.round((totalAnswered / totalExchanges) * 100) : 0;

  const latestDraft = await db.query.drafts.findFirst({
    where: eq(drafts.projectId, id),
    orderBy: (d, { desc }) => [desc(d.version)],
  });

  const saturation = (project.settings as any)?.latestSaturation ?? null;

  let daysRemaining: number | null = null;
  if (project.deadline) {
    const msRemaining = new Date(project.deadline).getTime() - Date.now();
    daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  }

  const progress: ProjectProgress = {
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      deadline: project.deadline?.toISOString() ?? null,
      daysRemaining,
      startedAt: project.startedAt?.toISOString() ?? null,
    },
    participants: participantStats,
    totalAnswered,
    totalExchanges,
    completionPct,
    saturation: saturation
      ? { scores: saturation.scores, readyToDraft: saturation.readyToDraft }
      : null,
    latestDraftVersion: latestDraft?.version ?? null,
  };

  return NextResponse.json(progress);
}
