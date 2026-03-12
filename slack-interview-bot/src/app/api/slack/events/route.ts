import { NextRequest, NextResponse } from "next/server";
import { getSlackApp } from "@/slack/app";
import crypto from "crypto";

/**
 * Slack Events API webhook handler.
 * In production (no Socket Mode), Slack sends events here via HTTP POST.
 * In development with Socket Mode, this endpoint just handles URL verification.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let body: any;

  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // URL verification challenge (Slack sends this when you first configure the endpoint)
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Verify the request is from Slack (signature check)
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (signingSecret) {
    const timestamp = request.headers.get("x-slack-request-timestamp") || "";
    const slackSignature = request.headers.get("x-slack-signature") || "";

    // Reject requests older than 5 minutes (replay attack prevention)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      return NextResponse.json({ error: "Request too old" }, { status: 403 });
    }

    const sigBaseString = `v0:${timestamp}:${rawBody}`;
    const expectedSignature =
      "v0=" +
      crypto
        .createHmac("sha256", signingSecret)
        .update(sigBaseString)
        .digest("hex");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(slackSignature),
        Buffer.from(expectedSignature)
      )
    ) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  // Process the event through the Slack app
  // In Events API mode, Bolt needs the request to be processed
  if (body.type === "event_callback") {
    try {
      const app = getSlackApp();
      // Bolt's processEvent handles routing to the correct event handler
      await app.processEvent({
        body,
        // Provide a minimal ack function for Bolt
        ack: async () => {},
      } as any);
    } catch (err) {
      console.error("Failed to process Slack event:", err);
      // Still return 200 to prevent Slack from retrying
    }
  }

  // Always return 200 to acknowledge receipt (Slack expects this within 3 seconds)
  return NextResponse.json({ ok: true });
}
