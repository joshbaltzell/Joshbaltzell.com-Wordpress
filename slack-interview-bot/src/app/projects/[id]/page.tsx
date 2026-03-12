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

function DeadlineBanner({ deadline, startedAt }: { deadline: Date; startedAt: Date | null }) {
  const now = new Date();
  const msRemaining = deadline.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  const isPast = daysRemaining <= 0;

  // Calculate elapsed progress if we have a start date
  let elapsedPct = 0;
  if (startedAt) {
    const totalDuration = deadline.getTime() - startedAt.getTime();
    const elapsed = now.getTime() - startedAt.getTime();
    elapsedPct = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
  }

  const urgencyClass = isPast
    ? "bg-red-50 border-red-200 text-red-800"
    : daysRemaining <= 2
      ? "bg-orange-50 border-orange-200 text-orange-800"
      : daysRemaining <= 7
        ? "bg-yellow-50 border-yellow-200 text-yellow-800"
        : "bg-blue-50 border-blue-200 text-blue-800";

  const barColor = isPast
    ? "bg-red-500"
    : daysRemaining <= 2
      ? "bg-orange-500"
      : daysRemaining <= 7
        ? "bg-yellow-500"
        : "bg-blue-500";

  return (
    <div className={`rounded-lg border p-4 mb-8 ${urgencyClass}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">
          {isPast
            ? "Past deadline!"
            : daysRemaining === 1
              ? "1 day until deadline"
              : `${daysRemaining} days until deadline`}
        </span>
        <span className="text-sm">
          {deadline.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
      {startedAt && (
        <div className="w-full bg-white/50 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${barColor} transition-all`}
            style={{ width: `${elapsedPct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ProgressBar({ answered, total }: { answered: number; total: number }) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{pct}% complete</span>
        <span>{answered}/{total}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="h-2 rounded-full bg-brand-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
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

      {/* Deadline banner */}
      {project.deadline && (
        <DeadlineBanner
          deadline={project.deadline}
          startedAt={project.startedAt}
        />
      )}

      {/* Overall progress (when interviewing) */}
      {project.status === "interviewing" && data.exchangeCount > 0 && (
        <div className="card p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Article Progress
          </h2>
          <ProgressBar answered={data.answeredExchanges} total={data.exchangeCount} />
        </div>
      )}

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
              const pPct = p.totalCount > 0 ? Math.round((p.answeredCount / p.totalCount) * 100) : 0;
              return (
                <div key={p.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{p.name}</span>
                        <span className={pBadge.class}>{pBadge.label}</span>
                      </div>
                      {p.title && (
                        <div className="text-sm text-gray-500">{p.title}</div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {p.answeredCount}/{p.totalCount} answered
                    </div>
                  </div>
                  {p.totalCount > 0 && (
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          p.status === "completed"
                            ? "bg-green-500"
                            : p.status === "declined"
                              ? "bg-red-300"
                              : "bg-brand-400"
                        }`}
                        style={{ width: `${pPct}%` }}
                      />
                    </div>
                  )}
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
