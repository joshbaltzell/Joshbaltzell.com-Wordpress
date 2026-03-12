"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useToast } from "@/app/components/toast";

interface Exchange {
  id: string;
  participantId: string;
  participantName: string;
  participantTitle: string | null;
  questionText: string;
  questionOrigin: string;
  answerText: string | null;
  sequence: number;
  status: string;
  askedAt: string | null;
  answeredAt: string | null;
}

type FilterParticipant = "all" | string;
type FilterOrigin = "all" | "manual" | "ai_followup" | "ai_crosspoll";

export default function QuotesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterParticipant, setFilterParticipant] = useState<FilterParticipant>("all");
  const [filterOrigin, setFilterOrigin] = useState<FilterOrigin>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [starred, setStarred] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/projects/${id}/exchanges`)
      .then((r) => r.json())
      .then((data: Exchange[]) => {
        // Only show answered exchanges
        setExchanges(data.filter((e) => e.status === "answered" && e.answerText));
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Extract unique participants
  const participants = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const ex of exchanges) {
      if (!map.has(ex.participantId)) {
        map.set(ex.participantId, {
          id: ex.participantId,
          name: ex.participantName,
        });
      }
    }
    return Array.from(map.values());
  }, [exchanges]);

  // Filtered exchanges
  const filtered = useMemo(() => {
    return exchanges.filter((ex) => {
      if (filterParticipant !== "all" && ex.participantId !== filterParticipant)
        return false;
      if (filterOrigin !== "all" && ex.questionOrigin !== filterOrigin)
        return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (ex.answerText || "").toLowerCase().includes(q) ||
          ex.questionText.toLowerCase().includes(q) ||
          ex.participantName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [exchanges, filterParticipant, filterOrigin, searchQuery]);

  // Sort: starred first, then by date
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aStarred = starred.has(a.id) ? 0 : 1;
      const bStarred = starred.has(b.id) ? 0 : 1;
      if (aStarred !== bStarred) return aStarred - bStarred;
      return (
        new Date(b.answeredAt || 0).getTime() -
        new Date(a.answeredAt || 0).getTime()
      );
    });
  }, [filtered, starred]);

  function toggleStar(exchangeId: string) {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(exchangeId)) {
        next.delete(exchangeId);
      } else {
        next.add(exchangeId);
      }
      return next;
    });
  }

  function copyQuote(text: string, attribution: string) {
    const quote = `"${text}" — ${attribution}`;
    navigator.clipboard.writeText(quote);
    toast("Copied to clipboard");
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="card p-4">
          <div className="flex gap-4">
            <div className="skeleton h-10 w-64" />
            <div className="skeleton h-10 w-40" />
            <div className="skeleton h-10 w-40" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-16 w-full" />
              <div className="skeleton h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quote Browser</h1>
          <p className="text-sm text-gray-500">
            {exchanges.length} quotes from {participants.length} participants
            {starred.size > 0 && (
              <span className="ml-2 text-yellow-600">
                ({starred.size} starred)
              </span>
            )}
          </p>
        </div>
        <button onClick={() => router.back()} className="btn-secondary">
          Back to Project
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label htmlFor="search" className="label">
              Search
            </label>
            <input
              id="search"
              type="text"
              className="input w-64"
              placeholder="Search quotes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="filterPart" className="label">
              Participant
            </label>
            <select
              id="filterPart"
              className="input w-auto"
              value={filterParticipant}
              onChange={(e) =>
                setFilterParticipant(e.target.value as FilterParticipant)
              }
            >
              <option value="all">All participants</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filterOrigin" className="label">
              Question Type
            </label>
            <select
              id="filterOrigin"
              className="input w-auto"
              value={filterOrigin}
              onChange={(e) =>
                setFilterOrigin(e.target.value as FilterOrigin)
              }
            >
              <option value="all">All types</option>
              <option value="manual">Seed questions</option>
              <option value="ai_followup">AI follow-ups</option>
              <option value="ai_crosspoll">Cross-pollination</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quote cards */}
      {sorted.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          {exchanges.length === 0
            ? "No answered quotes yet."
            : "No quotes match your filters."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((ex) => {
            const isStarred = starred.has(ex.id);
            return (
              <div
                key={ex.id}
                className={`card p-5 transition-all ${
                  isStarred
                    ? "ring-2 ring-yellow-400 bg-yellow-50"
                    : "hover:border-brand-300"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">
                      {ex.participantName}
                    </span>
                    {ex.participantTitle && (
                      <span className="text-xs text-gray-400">
                        {ex.participantTitle}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleStar(ex.id)}
                      className={`p-1 rounded transition-colors ${
                        isStarred
                          ? "text-yellow-500 hover:text-yellow-600"
                          : "text-gray-300 hover:text-yellow-400"
                      }`}
                      title={isStarred ? "Unstar" : "Star this quote"}
                    >
                      {isStarred ? "\u2605" : "\u2606"}
                    </button>
                    <button
                      onClick={() =>
                        copyQuote(
                          ex.answerText || "",
                          `${ex.participantName}${ex.participantTitle ? `, ${ex.participantTitle}` : ""}`
                        )
                      }
                      className="p-1 text-gray-300 hover:text-brand-500 rounded transition-colors text-xs"
                      title="Copy quote with attribution"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Question context */}
                <div className="text-xs text-brand-600 mb-2 font-medium">
                  Q: {ex.questionText}
                </div>

                {/* The quote */}
                <blockquote className="text-sm text-gray-700 border-l-2 border-brand-200 pl-3 italic">
                  &ldquo;{ex.answerText}&rdquo;
                </blockquote>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3">
                  <span className="badge-gray text-xs">
                    Q{ex.sequence}
                  </span>
                  {ex.answeredAt && (
                    <span className="text-xs text-gray-400">
                      {new Date(ex.answeredAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
