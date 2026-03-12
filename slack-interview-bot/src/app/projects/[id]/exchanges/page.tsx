import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { projects, exchanges, participants, questions } from "@/db/schema";
import { eq } from "drizzle-orm";

type PageParams = { params: Promise<{ id: string }> };

const ORIGIN_LABELS: Record<string, string> = {
  manual: "Seed",
  ai_followup: "Follow-up",
  ai_crosspoll: "Cross-poll",
};

export default async function ExchangesPage({ params }: PageParams) {
  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) notFound();

  const allExchanges = await db
    .select({
      id: exchanges.id,
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Exchanges — {project.title}
        </h1>
        <Link href={`/projects/${id}`} className="btn-secondary">
          Back to Project
        </Link>
      </div>

      {allExchanges.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          No exchanges yet. Start interviewing to see responses here.
        </div>
      ) : (
        <div className="space-y-4">
          {allExchanges.map((ex) => (
            <div key={ex.id} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {ex.participantName}
                  </span>
                  {ex.participantTitle && (
                    <span className="text-sm text-gray-400">
                      {ex.participantTitle}
                    </span>
                  )}
                  <span className="badge-gray text-xs">
                    {ORIGIN_LABELS[ex.questionOrigin] || ex.questionOrigin}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    Q{ex.sequence}
                  </span>
                  <span
                    className={
                      ex.status === "answered"
                        ? "badge-green"
                        : ex.status === "sent"
                          ? "badge-blue"
                          : "badge-gray"
                    }
                  >
                    {ex.status}
                  </span>
                </div>
              </div>
              <div className="mb-2">
                <div className="text-sm font-medium text-brand-700 mb-1">
                  Q:
                </div>
                <p className="text-sm text-gray-700">{ex.questionText}</p>
              </div>
              {ex.answerText && (
                <div className="mt-3 pl-4 border-l-2 border-brand-200">
                  <div className="text-sm font-medium text-brand-700 mb-1">
                    A:
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {ex.answerText}
                  </p>
                  {ex.answeredAt && (
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(ex.answeredAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
