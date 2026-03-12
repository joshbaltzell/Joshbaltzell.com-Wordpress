"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewProjectPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const deadlineStr = form.get("deadline") as string;
    const data: Record<string, unknown> = {
      title: form.get("title") as string,
      thesis: form.get("thesis") as string,
      targetAudience: form.get("targetAudience") as string,
      targetWordCount: parseInt(form.get("targetWordCount") as string) || 1500,
      approvalMode: form.get("approvalMode") as string,
      maxRounds: parseInt(form.get("maxRounds") as string) || 10,
      nudgeAfterHours: parseInt(form.get("nudgeAfterHours") as string) || 48,
      autoCompileOnDeadline: form.get("autoCompileOnDeadline") === "on",
    };
    if (deadlineStr) {
      data.deadline = deadlineStr;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create project");
      }

      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        New Interview Project
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="title" className="label">
            Article Title *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            className="input"
            placeholder="Why most e-commerce replatforming projects fail"
          />
        </div>

        <div>
          <label htmlFor="thesis" className="label">
            Thesis / Angle
          </label>
          <textarea
            id="thesis"
            name="thesis"
            rows={3}
            className="input"
            placeholder="The problem is almost never the technology — it's organizational alignment and migration planning."
          />
          <p className="text-xs text-gray-500 mt-1">
            The editorial angle. This guides the AI&apos;s question generation.
          </p>
        </div>

        <div>
          <label htmlFor="targetAudience" className="label">
            Target Audience
          </label>
          <input
            id="targetAudience"
            name="targetAudience"
            type="text"
            className="input"
            placeholder="Tech leaders evaluating platform migrations"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="targetWordCount" className="label">
              Target Word Count
            </label>
            <input
              id="targetWordCount"
              name="targetWordCount"
              type="number"
              defaultValue={1500}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="maxRounds" className="label">
              Max Questions/Person
            </label>
            <input
              id="maxRounds"
              name="maxRounds"
              type="number"
              defaultValue={10}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="nudgeAfterHours" className="label">
              Nudge After (hours)
            </label>
            <input
              id="nudgeAfterHours"
              name="nudgeAfterHours"
              type="number"
              defaultValue={48}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="deadline" className="label">
              Deadline (optional)
            </label>
            <input
              id="deadline"
              name="deadline"
              type="date"
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">
              If set, the article will auto-compile with whatever material is available.
            </p>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="autoCompileOnDeadline"
                defaultChecked
                className="rounded border-gray-300"
              />
              Auto-compile on deadline
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="approvalMode" className="label">
            AI Question Approval
          </label>
          <select
            id="approvalMode"
            name="approvalMode"
            defaultValue="auto"
            className="input"
          >
            <option value="auto">
              Auto — High-priority follow-ups auto-send, cross-poll needs
              approval
            </option>
            <option value="editor_approves_all">
              Editor Approves All — Every AI question needs your OK
            </option>
            <option value="full_auto">
              Full Auto — Everything sends automatically
            </option>
          </select>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Creating..." : "Create Project"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
