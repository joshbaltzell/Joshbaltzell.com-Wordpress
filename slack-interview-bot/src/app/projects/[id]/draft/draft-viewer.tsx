"use client";

import { useRouter } from "next/navigation";

interface DraftSummary {
  id: string;
  version: number;
  createdAt: string;
}

export function DraftViewer({
  projectId,
  allDrafts,
  latestDraftId,
  compareId,
}: {
  projectId: string;
  allDrafts: DraftSummary[];
  latestDraftId: string;
  compareId: string | null;
}) {
  const router = useRouter();

  function handleCompare(draftId: string) {
    if (draftId === "none") {
      router.push(`/projects/${projectId}/draft`);
    } else {
      router.push(`/projects/${projectId}/draft?compare=${draftId}`);
    }
  }

  const olderDrafts = allDrafts.filter((d) => d.id !== latestDraftId);

  return (
    <div className="card p-4 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <span className="text-sm font-medium text-gray-700">
          Compare with:
        </span>
        <select
          className="input text-sm w-auto"
          value={compareId ?? "none"}
          onChange={(e) => handleCompare(e.target.value)}
        >
          <option value="none">No comparison</option>
          {olderDrafts.map((d) => (
            <option key={d.id} value={d.id}>
              v{d.version} — {new Date(d.createdAt).toLocaleDateString()}
            </option>
          ))}
        </select>
        {compareId && (
          <button
            className="btn-secondary text-xs"
            onClick={() => handleCompare("none")}
          >
            Clear comparison
          </button>
        )}
      </div>
    </div>
  );
}
