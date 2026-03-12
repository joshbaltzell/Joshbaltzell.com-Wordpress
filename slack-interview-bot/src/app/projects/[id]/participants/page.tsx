"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Participant {
  id: string;
  slackUserId: string;
  name: string;
  title: string | null;
  role: string;
  context: string | null;
  status: string;
}

export default function ParticipantsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [slackUserId, setSlackUserId] = useState("");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${id}/participants`)
      .then((r) => r.json())
      .then(setParticipants)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slackUserId,
          title: title || undefined,
          context: context || undefined,
          role: "interviewee",
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        alert(body.error || "Failed to add participant");
        return;
      }
      const participant = await res.json();
      setParticipants([...participants, participant]);
      setName("");
      setSlackUserId("");
      setTitle("");
      setContext("");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Participants</h1>
        <button onClick={() => router.back()} className="btn-secondary">
          Back to Project
        </button>
      </div>

      {/* Add participant form */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">
          Add Participant
        </h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="label">
                Name *
              </label>
              <input
                id="name"
                type="text"
                required
                className="input"
                placeholder="Sarah Chen"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="slackUserId" className="label">
                Slack User ID *
              </label>
              <input
                id="slackUserId"
                type="text"
                required
                className="input"
                placeholder="U01ABC23DEF"
                value={slackUserId}
                onChange={(e) => setSlackUserId(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Find this in their Slack profile &gt; More &gt; Copy member ID
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="title" className="label">
              Job Title
            </label>
            <input
              id="title"
              type="text"
              className="input"
              placeholder="VP of Engineering"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="context" className="label">
              Why include them?
            </label>
            <textarea
              id="context"
              rows={2}
              className="input"
              placeholder="Led the Acme Corp platform migration and has strong opinions on data migration planning"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              This context helps the AI tailor questions to their expertise.
            </p>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Adding..." : "Add Participant"}
          </button>
        </form>
      </div>

      {/* Participant list */}
      {participants.length > 0 && (
        <div className="card divide-y divide-gray-100">
          {participants.map((p) => (
            <div key={p.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">{p.name}</span>
                  {p.title && (
                    <span className="text-gray-500 ml-2">{p.title}</span>
                  )}
                </div>
                <span className="badge-gray">{p.status}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Slack: {p.slackUserId}
              </div>
              {p.context && (
                <div className="text-sm text-gray-500 mt-1">{p.context}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
