import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { projects, participants, exchanges, questions, drafts } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { ProjectActions } from "./project-actions";

type PageParams = { params: Promise<{ id: string }> };

const STATUS_BADGES: Record<string, { class: string; label: string }> = {
  setup: { class: "badge-gray", label: "Setup" },
  interviewing: { class: "badge-blue", label: "Interviewing" },
  compiling: { class: "badge-yellow", label: "Compiling" },
  review: { class: "badge-purple", label: "In Review" },
  published: { class: "badge-green", label: "Published" },
};

const PARTICIPANT_STATUS_BADGES: Record<string, { class: string; label: string }> = {
  pending: { class: "badge-gray", label: "Pending" },
  active: { class: "badge-blue", label: "Active" },
  completed: { class: "badge-green", label: "Done" },
  declined: { class: "bg-red-100 text-red-700 badge", label: "Declined" },
};

async function getProjectData(id: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) return null;

  const projectParticipants = await db.query.participants.findMany({
    where: eq(participants.projectId, id),
    orderBy: (p, { asc }) => [asc(p.createdAt)],
  });

  // Get exchange counts per participant
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
        ...p,
        answeredCount: answered?.count ?? 0,
        totalCount: total?.count ?? 0,
      };
    })
  );

  const [questionCount] = await db
    .select({ count: count() })
    .from(questions)
    .where(eq(questions.projectId, id));

  const [pendingApproval] = await db
    .select({ count: count() })
    .from(questions)
    .where(and(eq(questions.projectId, id), eq(questions.approved, false)));

  const [exchangeCount] = await db
    .select({ count: count() })
    .from(exchanges)
    .where(eq(exchanges.projectId, id));

  const [answeredExchanges] = await db
    .select({ count: count() })
    .from(exchanges)
    .where(and(eq(exchanges.projectId, id), eq(exchanges.status, "answered")));

  const latestDraft = await db.query.drafts.findFirst({
    where: eq(drafts.projectId, id),
    orderBy: (d, { desc }) => [desc(d.version)],
  });

  const saturation = (project.settings as any)?.latestSaturation ?? null;

  return {
    project,
    participants: participantStats,
    questionCount: questionCount?.count ?? 0,
    pendingApproval: pendingApproval?.count ?? 0,
    exchangeCount: exchangeCount?.count ?? 0,
    answeredExchanges: answeredExchanges?.count ?? 0,
    latestDraft,
    saturation,
  };
}

export default async function ProjectDetailPage({ params }: PageParams) {
  const { id } = await params;
  const data = await getProjectData(id);

  if (!data) notFound();

  const { project, participants: participantList } = data;
  const badge = STATUS_BADGES[project.status] ?? STATUS_BADGES.setup;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {project.title}
            </h1>
            <span className={badge.class}>{badge.label}</span>
          </div>
          {project.thesis && (
            <p className="text-gray-500 max-w-2xl">{project.thesis}</p>
          )}
          {project.targetAudience && (
            <p className="text-sm text-gray-400 mt-1">
              Audience: {project.targetAudience}
            </p>
          )}
        </div>
        <ProjectActions projectId={id} status={project.status} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-900">
            {participantList.length}
          </div>
          <div className="text-sm text-gray-500">Participants</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-900">
            {data.answeredExchanges}/{data.exchangeCount}
          </div>
          <div className="text-sm text-gray-500">Exchanges answered</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-900">
            {data.questionCount}
          </div>
          <div className="text-sm text-gray-500">
            Questions
            {data.pendingApproval > 0 && (
              <span className="text-yellow-600 ml-1">
                ({data.pendingApproval} pending)
              </span>
            )}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-900">
            {data.latestDraft ? `v${data.latestDraft.version}` : "—"}
          </div>
          <div className="text-sm text-gray-500">Draft version</div>
        </div>
      </div>

      {/* Saturation scores (if available) */}
      {data.saturation && (
        <div className="card p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Saturation Assessment
          </h2>
          <div className="grid grid-cols-5 gap-4">
            {Object.entries(data.saturation.scores).map(([key, value]) => (
              <div key={key} className="text-center">
                <div
                  className={`text-xl font-bold ${
                    (value as number) >= 4
                      ? "text-green-600"
                      : (value as number) >= 3
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {value as number}/5
                </div>
                <div className="text-xs text-gray-500 capitalize">{key}</div>
              </div>
            ))}
          </div>
          {data.saturation.readyToDraft && (
            <p className="text-sm text-green-600 mt-3 font-medium">
              Ready to compile a draft
            </p>
          )}
          {data.saturation.gaps?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Gaps:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {data.saturation.gaps.map((gap: string, i: number) => (
                  <li key={i}>- {gap}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Participants */}
      <div className="card mb-8">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Participants</h2>
          {project.status === "setup" && (
            <Link
              href={`/projects/${id}/participants`}
              className="text-sm text-brand-600 hover:text-brand-700"
            >
              Manage
            </Link>
          )}
        </div>
        {participantList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="mb-3">No participants yet</p>
            <Link
              href={`/projects/${id}/participants`}
              className="btn-primary text-sm"
            >
              Add Participants
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {participantList.map((p) => {
              const pBadge = PARTICIPANT_STATUS_BADGES[p.status] ?? PARTICIPANT_STATUS_BADGES.pending;
              return (
                <div key={p.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <span className={pBadge.class}>{pBadge.label}</span>
                    </div>
                    {p.title && (
                      <div className="text-sm text-gray-500">{p.title}</div>
                    )}
                    {p.context && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {p.context}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {p.answeredCount}/{p.totalCount} answered
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-4 gap-4">
        <Link
          href={`/projects/${id}/exchanges`}
          className="card p-4 hover:border-brand-300 transition-colors text-center"
        >
          <div className="font-medium text-gray-900">Exchanges</div>
          <div className="text-sm text-gray-500">View all Q&A</div>
        </Link>
        <Link
          href={`/projects/${id}/questions`}
          className="card p-4 hover:border-brand-300 transition-colors text-center"
        >
          <div className="font-medium text-gray-900">Questions</div>
          <div className="text-sm text-gray-500">Review & approve</div>
        </Link>
        <Link
          href={`/projects/${id}/quotes`}
          className="card p-4 hover:border-brand-300 transition-colors text-center"
        >
          <div className="font-medium text-gray-900">Quotes</div>
          <div className="text-sm text-gray-500">Browse & star</div>
        </Link>
        {data.latestDraft ? (
          <Link
            href={`/projects/${id}/draft`}
            className="card p-4 hover:border-brand-300 transition-colors text-center"
          >
            <div className="font-medium text-gray-900">Draft</div>
            <div className="text-sm text-gray-500">
              Version {data.latestDraft.version}
            </div>
          </Link>
        ) : (
          <div className="card p-4 text-center opacity-50">
            <div className="font-medium text-gray-900">Draft</div>
            <div className="text-sm text-gray-500">Not yet compiled</div>
          </div>
        )}
      </div>
    </div>
  );
}
