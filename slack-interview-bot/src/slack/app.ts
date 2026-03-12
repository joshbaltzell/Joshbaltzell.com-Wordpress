import { App, LogLevel } from "@slack/bolt";
import { registerCommands } from "./commands";
import { registerEvents } from "./events";
import { registerActions } from "./actions";

let _app: App | null = null;

export function getSlackApp(): App {
  if (!_app) {
    const useSocketMode = !!process.env.SLACK_APP_TOKEN;

    _app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      ...(useSocketMode
        ? {
            socketMode: true,
            appToken: process.env.SLACK_APP_TOKEN,
          }
        : {}),
      logLevel:
        process.env.NODE_ENV === "development"
          ? LogLevel.DEBUG
          : LogLevel.INFO,
    });

    // Register all handlers
    registerCommands(_app);
    registerEvents(_app);
    registerActions(_app);
  }

  return _app;
}

export async function startSlackApp(): Promise<void> {
  const app = getSlackApp();

  if (process.env.SLACK_APP_TOKEN) {
    // Socket Mode — connects via WebSocket (development)
    await app.start();
    console.log("Slack bot started in Socket Mode");
  } else {
    // Events API — handled by Next.js API route (production)
    console.log("Slack bot initialized for Events API mode");
  }
}
