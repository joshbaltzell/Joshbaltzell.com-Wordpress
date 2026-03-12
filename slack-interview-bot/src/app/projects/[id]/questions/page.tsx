"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Question {
  id: string;
  text: string;
  origin: string;
  priority: string;
  approved: boolean;
  createdAt: string;
}

const ORIGIN_LABELS: Record<string, { label: string; class: string }> = {
  manual: { label: "Manual", class: "badge-gray" },
  ai_followup: { label: "AI Follow-up", class: "badge-blue" },
  ai_crosspoll: { label: "AI Cross-poll", class: "badge-purple" },
};

const PRIORITY_LABELS: Record<string, { label: string; class: string }> = {
  high: { label: "High", class: "bg-red-100 text-red-700" },
  medium: { label: "Medium", class: "badge-yellow" },
  low: { label: "Low", class: "badge-gray" },
};

export default function QuestionsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${id}/questions`)
      .then((r) => r.json())
      .then(setQuestions)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newQuestion, priority: "high" }),
      });
      if (res.ok) {
        const q = await res.json();
        setQuestions([q, ...questions]);
        setNewQuestion("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleApproval(questionId: string, approved: boolean) {
    const res = await fetch(`/api/projects/${id}/questions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, approved }),
    });
    if (res.ok) {
      setQuestions(
        questions.map((q) => (q.id === questionId ? { ...q, approved } : q))
      );
    }
  }

  const pendingQuestions = questions.filter((q) => !q.approved);
  const approvedQuestions = questions.filter((q) => q.approved);

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="skeleton h-8 w-36" />
        <div className="card p-4 space-y-3">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-16 w-full" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 space-y-2">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Questions</h1>
        <button onClick={() => router.back()} className="btn-secondary">
          Back to Project
        </button>
      </div>

      {/* Add manual question */}
      <form onSubmit={handleAdd} className="card p-4 mb-6">
        <label htmlFor="newQ" className="label">
          Add a question
        </label>
        <div className="flex gap-2">
          <textarea
            id="newQ"
            rows={2}
            className="input flex-1"
            placeholder="What's been the biggest surprise in your experience with..."
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
          />
          <button type="submit" disabled={saving} className="btn-primary self-end">
            {saving ? "Adding..." : "Add"}
          </button>
        </div>
      </form>

      {/* Pending approval */}
      {pendingQuestions.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-gray-900 mb-3">
            Pending Approval ({pendingQuestions.length})
          </h2>
          <div className="space-y-2">
            {pendingQuestions.map((q) => {
              const origin = ORIGIN_LABELS[q.origin] ?? ORIGIN_LABELS.manual;
              const priority = PRIORITY_LABELS[q.priority] ?? PRIORITY_LABELS.medium;
              return (
                <div key={q.id} className="card p-4 border-yellow-200 bg-yellow-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge text-xs ${origin.class}`}>
                          {origin.label}
                        </span>
                        <span className={`badge text-xs ${priority.class}`}>
                          {priority.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800">{q.text}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleApproval(q.id, true)}
                        className="btn-primary text-xs px-3 py-1"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApproval(q.id, false)}
                        className="btn-danger text-xs px-3 py-1"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Approved questions */}
      <h2 className="font-semibold text-gray-900 mb-3">
        Approved ({approvedQuestions.length})
      </h2>
      <div className="space-y-2">
        {approvedQuestions.map((q) => {
          const origin = ORIGIN_LABELS[q.origin] ?? ORIGIN_LABELS.manual;
          return (
            <div key={q.id} className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`badge text-xs ${origin.class}`}>
                  {origin.label}
                </span>
              </div>
              <p className="text-sm text-gray-700">{q.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
