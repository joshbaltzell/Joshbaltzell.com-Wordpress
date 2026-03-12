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
    if (!confirm("This will send outreach messages to all participants via Quotable. Continue?"))
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
      const parts = [`Draft v${result.draft.version} compiled with ${result.quoteCount} quotes`];
      if (result.paraphraseCount > 0) {
        parts.push(`${result.paraphraseCount} paraphrases`);
      }
      if (result.mismatches?.length > 0) {
        parts.push(`Warning: ${result.mismatches.length} quote mismatches`);
      }
      if (result.riskyParaphraseCount > 0) {
        parts.push(`${result.riskyParaphraseCount} paraphrases need source approval`);
      }
      alert(parts.join(". ") + ".");
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading("");
    }
  }

  async function handleSendQuoteApprovals() {
    if (!confirm("Send quote approval requests to all participants via Slack?"))
      return;
    setLoading("approvals");
    try {
      const res = await fetch(`/api/projects/${projectId}/quote-approvals`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        alert(body.error || "Failed to send approvals");
        return;
      }
      const result = await res.json();
      alert(
        `Sent ${result.totalQuotesSent} quotes to ${result.participantsContacted} participants for review.`
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
      {status === "review" && (
        <button
          onClick={handleSendQuoteApprovals}
          disabled={loading === "approvals"}
          className="btn-primary"
        >
          {loading === "approvals" ? "Sending..." : "Send Quote Approvals"}
        </button>
      )}
    </div>
  );
}
