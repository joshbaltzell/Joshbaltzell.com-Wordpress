import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { projects, drafts, draftQuoteRefs, exchanges, participants } from "@/db/schema";
import { eq } from "drizzle-orm";

type PageParams = { params: Promise<{ id: string }> };

export default async function DraftPage({ params }: PageParams) {
  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) notFound();

  const latestDraft = await db.query.drafts.findFirst({
    where: eq(drafts.projectId, id),
    orderBy: (d, { desc }) => [desc(d.version)],
  });

  if (!latestDraft) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Draft — {project.title}
          </h1>
          <Link href={`/projects/${id}`} className="btn-secondary">
            Back to Project
          </Link>
        </div>
        <div className="card p-12 text-center text-gray-500">
          No draft yet. Compile one from the project page.
        </div>
      </div>
    );
  }

  // Get quote refs for this draft
  const quoteRefs = await db
    .select({
      id: draftQuoteRefs.id,
      exchangeId: draftQuoteRefs.exchangeId,
      quoteSnippet: draftQuoteRefs.quoteSnippet,
      locationHint: draftQuoteRefs.locationHint,
      editorIncluded: draftQuoteRefs.editorIncluded,
      participantName: participants.name,
    })
    .from(draftQuoteRefs)
    .innerJoin(exchanges, eq(draftQuoteRefs.exchangeId, exchanges.id))
    .innerJoin(participants, eq(exchanges.participantId, participants.id))
    .where(eq(draftQuoteRefs.draftId, latestDraft.id));

  // Process draft body — replace [QUOTE_ID:xxx] with highlighted spans
  // and [EDITOR_CHOICE: ...] / [EDITOR_NOTE: ...] with callouts
  const processedBody = latestDraft.body
    .replace(
      /\[QUOTE_ID:([^\]]+)\]/g,
      '<span class="text-xs text-brand-500 align-super cursor-help" title="Quote reference">[$1]</span>'
    )
    .replace(
      /\[EDITOR_CHOICE:\s*([^|]+)\s*\|\s*([^\]]+)\]/g,
      '<div class="my-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"><div class="text-xs font-semibold text-yellow-700 mb-1">EDITOR CHOICE</div><div class="text-sm"><strong>A:</strong> $1<br/><strong>B:</strong> $2</div></div>'
    )
    .replace(
      /\[EDITOR_NOTE:\s*([^\]]+)\]/g,
      '<div class="my-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700"><strong>Note:</strong> $1</div>'
    );

  // All drafts for version history
  const allDrafts = await db.query.drafts.findMany({
    where: eq(drafts.projectId, id),
    orderBy: (d, { desc }) => [desc(d.version)],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Draft — {latestDraft.title || project.title}
          </h1>
          <p className="text-sm text-gray-500">
            Version {latestDraft.version} — compiled with {latestDraft.modelUsed}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {allDrafts.length > 1 && (
            <select className="input text-sm w-auto">
              {allDrafts.map((d) => (
                <option key={d.id} value={d.id}>
                  v{d.version} —{" "}
                  {new Date(d.createdAt!).toLocaleDateString()}
                </option>
              ))}
            </select>
          )}
          <Link href={`/projects/${id}`} className="btn-secondary">
            Back to Project
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Draft content */}
        <div className="col-span-2">
          <div className="card p-8">
            <article
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: processedBody }}
            />
          </div>
        </div>

        {/* Quote sidebar */}
        <div>
          <div className="card p-4 sticky top-20">
            <h3 className="font-semibold text-gray-900 mb-3">
              Quotes Used ({quoteRefs.length})
            </h3>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {quoteRefs.map((ref) => (
                <div
                  key={ref.id}
                  className={`p-3 rounded-lg border text-sm ${
                    ref.editorIncluded
                      ? "bg-green-50 border-green-200"
                      : "bg-gray-50 border-gray-200 opacity-60"
                  }`}
                >
                  <div className="font-medium text-gray-700 text-xs mb-1">
                    {ref.participantName}
                  </div>
                  <p className="text-gray-600 line-clamp-3">
                    &ldquo;{ref.quoteSnippet}&rdquo;
                  </p>
                  <div className="text-xs text-gray-400 mt-1">
                    {ref.locationHint}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
