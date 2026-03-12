"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/app/components/toast";

export function ProjectActions({
  projectId,
  status,
}: {
  projectId: string;
  status: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState("");
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  async function handleStart() {
    setShowConfirm(null);
    setLoading("start");
    try {
      const res = await fetch(`/api/projects/${projectId}/start`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        toast(body.error || "Failed to start", "error");
        return;
      }
      const result = await res.json();
      toast(
        `Started! ${result.started} participants contacted${result.failed > 0 ? `, ${result.failed} failed` : ""}.`
      );
      router.refresh();
    } catch (err: any) {
      toast(err.message, "error");
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
        toast(body.error || "Failed to compile", "error");
        return;
      }
      const result = await res.json();
      const parts = [`Draft v${result.draft.version} compiled with ${result.quoteCount} quotes`];
      if (result.paraphraseCount > 0) {
        parts.push(`${result.paraphraseCount} paraphrases`);
      }
      if (result.mismatches?.length > 0) {
        parts.push(`${result.mismatches.length} quote mismatches`);
      }
      if (result.riskyParaphraseCount > 0) {
        parts.push(`${result.riskyParaphraseCount} paraphrases need source approval`);
      }
      toast(parts.join(". ") + ".");
      router.refresh();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading("");
    }
  }

  async function handleSendQuoteApprovals() {
    setShowConfirm(null);
    setLoading("approvals");
    try {
      const res = await fetch(`/api/projects/${projectId}/quote-approvals`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        toast(body.error || "Failed to send approvals", "error");
        return;
      }
      const result = await res.json();
      toast(
        `Sent ${result.totalQuotesSent} quotes to ${result.participantsContacted} participants for review.`
      );
      router.refresh();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading("");
    }
  }

  async function handlePublish() {
    setShowConfirm(null);
    setLoading("publish");
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast(body.error || "Failed to publish", "error");
        return;
      }
      toast("Article marked as published!");
      router.refresh();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading("");
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {status === "setup" && (
          <button
            onClick={() => setShowConfirm("start")}
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
          <>
            <button
              onClick={() => setShowConfirm("approvals")}
              disabled={loading === "approvals"}
              className="btn-primary"
            >
              {loading === "approvals" ? "Sending..." : "Send Quote Approvals"}
            </button>
            <button
              onClick={() => setShowConfirm("publish")}
              disabled={loading === "publish"}
              className="btn-secondary"
            >
              {loading === "publish" ? "Publishing..." : "Mark as Published"}
            </button>
          </>
        )}
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              {showConfirm === "start" && "Start interviews?"}
              {showConfirm === "approvals" && "Send quote approvals?"}
              {showConfirm === "publish" && "Publish article?"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {showConfirm === "start" &&
                "This will send outreach messages to all participants via Slack. They'll receive a DM from Quotable inviting them to participate."}
              {showConfirm === "approvals" &&
                "This will send quote approval requests to all participants via Slack. Each participant will review and approve/reject their quotes."}
              {showConfirm === "publish" &&
                "This marks the article as published. Make sure all quote approvals are complete and the draft is finalized."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={
                  showConfirm === "start"
                    ? handleStart
                    : showConfirm === "approvals"
                      ? handleSendQuoteApprovals
                      : handlePublish
                }
                className={showConfirm === "publish" ? "btn-primary" : "btn-primary"}
              >
                {showConfirm === "start" && "Start Interviews"}
                {showConfirm === "approvals" && "Send Approvals"}
                {showConfirm === "publish" && "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
