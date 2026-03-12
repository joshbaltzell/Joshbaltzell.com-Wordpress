"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProjectActions({
  projectId,
  status,
}: {
  projectId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState("");

  async function handleStart() {
    if (!confirm("This will send outreach messages to all participants. Continue?"))
      return;
    setLoading("start");
    try {
      const res = await fetch(`/api/projects/${projectId}/start`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        alert(body.error || "Failed to start");
        return;
      }
      const result = await res.json();
      alert(
        `Started! ${result.started} participants contacted${result.failed > 0 ? `, ${result.failed} failed` : ""}.`
      );
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading("");
    }
  }

  async function handleCompile() {
    setLoading("compile");
    try {
      const res = await fetch(`/api/projects/${projectId}/compile`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        alert(body.error || "Failed to compile");
        return;
      }
      const result = await res.json();
      alert(
        `Draft v${result.draft.version} compiled with ${result.quoteCount} quotes.${result.mismatches.length > 0 ? ` Warning: ${result.mismatches.length} quote mismatches detected.` : ""}`
      );
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {status === "setup" && (
        <button
          onClick={handleStart}
          disabled={loading === "start"}
          className="btn-primary"
        >
          {loading === "start" ? "Starting..." : "Start Interviews"}
        </button>
      )}
      {(status === "interviewing" || status === "compiling") && (
        <button
          onClick={handleCompile}
          disabled={loading === "compile"}
          className="btn-primary"
        >
          {loading === "compile" ? "Compiling..." : "Compile Draft"}
        </button>
      )}
    </div>
  );
}
