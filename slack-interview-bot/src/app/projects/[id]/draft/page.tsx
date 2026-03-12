import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { projects, drafts, draftQuoteRefs, exchanges, participants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DraftViewer } from "./draft-viewer";

type PageParams = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ compare?: string }>;
};

function processDraftBody(body: string): string {
  return body
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
}

export default async function DraftPage({ params, searchParams }: PageParams) {
  const { id } = await params;
  const { compare } = await searchParams;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) notFound();

  // All drafts for version history
  const allDrafts = await db.query.drafts.findMany({
    where: eq(drafts.projectId, id),
    orderBy: (d, { desc }) => [desc(d.version)],
  });

  const latestDraft = allDrafts[0];

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

  const processedBody = processDraftBody(latestDraft.body);

  // If comparing, get the comparison draft
  const compareDraft = compare
    ? allDrafts.find((d) => d.id === compare)
    : null;

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Draft — {latestDraft.title || project.title}
          </h1>
          <p className="text-sm text-gray-500">
            Version {latestDraft.version} — compiled with {latestDraft.modelUsed}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/projects/${id}`} className="btn-secondary">
            Back to Project
          </Link>
        </div>
      </div>

      {/* Version comparison controls */}
      {allDrafts.length > 1 && (
        <DraftViewer
          projectId={id}
          allDrafts={allDrafts.map((d) => ({
            id: d.id,
            version: d.version,
            createdAt: d.createdAt?.toISOString() ?? "",
            body: d.body,
          }))}
          latestDraftId={latestDraft.id}
          compareId={compare ?? null}
        />
      )}

      {/* Diff view */}
      {compareDraft && (
        <div className="card p-5 mb-6 border-yellow-200 bg-yellow-50">
          <h3 className="font-semibold text-gray-900 mb-3">
            Changes: v{compareDraft.version} → v{latestDraft.version}
          </h3>
          <DiffView
            oldText={compareDraft.body}
            newText={latestDraft.body}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Draft content */}
        <div className="lg:col-span-2">
          <div className="card p-6 sm:p-8">
            <article
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: processedBody }}
            />
          </div>
        </div>

        {/* Quote sidebar */}
        <div>
          <div className="card p-4 lg:sticky lg:top-20">
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

/**
 * Simple line-based diff view. Shows added/removed paragraphs between versions.
 */
function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  // Clean markup for comparison
  const clean = (t: string) =>
    t.replace(/\[QUOTE_ID:[^\]]+\]/g, "").replace(/\[EDITOR_(?:CHOICE|NOTE):[^\]]+\]/g, "");

  const oldParagraphs = clean(oldText).split(/\n{2,}/).filter(Boolean);
  const newParagraphs = clean(newText).split(/\n{2,}/).filter(Boolean);

  // Simple LCS-based diff
  const oldSet = new Set(oldParagraphs);
  const newSet = new Set(newParagraphs);

  const removed = oldParagraphs.filter((p) => !newSet.has(p));
  const added = newParagraphs.filter((p) => !oldSet.has(p));
  const unchanged = newParagraphs.filter((p) => oldSet.has(p));

  if (removed.length === 0 && added.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No text changes between versions (only formatting/metadata).</p>
    );
  }

  return (
    <div className="space-y-2 text-sm max-h-96 overflow-y-auto">
      {removed.map((p, i) => (
        <div key={`r-${i}`} className="bg-red-100 border-l-4 border-red-400 p-2 rounded-r">
          <span className="text-red-700 font-mono text-xs mr-2">-</span>
          <span className="text-red-800">{p.slice(0, 200)}{p.length > 200 ? "..." : ""}</span>
        </div>
      ))}
      {added.map((p, i) => (
        <div key={`a-${i}`} className="bg-green-100 border-l-4 border-green-400 p-2 rounded-r">
          <span className="text-green-700 font-mono text-xs mr-2">+</span>
          <span className="text-green-800">{p.slice(0, 200)}{p.length > 200 ? "..." : ""}</span>
        </div>
      ))}
      <p className="text-xs text-gray-400 mt-2">
        {removed.length} removed, {added.length} added, {unchanged.length} unchanged paragraphs
      </p>
    </div>
  );
}
