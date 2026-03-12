import { NextRequest, NextResponse } from "next/server";
import { getSlackApp } from "@/slack/app";

/**
 * Slack Events API webhook handler.
 * In production (no Socket Mode), Slack sends events here via HTTP POST.
 * In development with Socket Mode, this endpoint just handles URL verification.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  // URL verification challenge (Slack sends this when you first configure the endpoint)
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // For Events API mode, we need to process the event through Bolt
  // This is handled automatically when Bolt is configured with a receiver
  // For now, we acknowledge receipt and let Socket Mode handle events in dev
  return NextResponse.json({ ok: true });
}
