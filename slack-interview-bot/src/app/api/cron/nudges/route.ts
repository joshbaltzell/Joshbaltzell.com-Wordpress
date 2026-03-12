import { NextRequest, NextResponse } from "next/server";
import { scheduleNudges } from "@/jobs/schedule-nudges";

/**
 * Cron endpoint for scheduling nudges.
 * Call this every hour from an external cron service (Railway, Vercel Cron, etc.)
 *
 * Optionally protect with a secret:
 *   GET /api/cron/nudges?secret=YOUR_CRON_SECRET
 */
export async function GET(request: NextRequest) {
  // Optional auth check
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("secret") !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await scheduleNudges();
    return NextResponse.json({
      success: true,
      ...result,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Nudge scheduling failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
