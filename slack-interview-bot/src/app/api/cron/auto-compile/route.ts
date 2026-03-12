import { NextRequest, NextResponse } from "next/server";
import { checkAutoCompile } from "@/jobs/auto-compile";

/**
 * Cron endpoint for auto-compiling articles when deadlines pass.
 * Call this every hour from an external cron service.
 *
 * GET /api/cron/auto-compile?secret=YOUR_CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("secret") !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await checkAutoCompile();
    return NextResponse.json({
      success: true,
      ...result,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Auto-compile check failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
