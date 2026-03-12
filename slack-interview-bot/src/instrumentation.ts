/**
 * Next.js instrumentation hook — runs once when the server starts.
 * We use this to validate env vars and initialize the Slack bot and background workers.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the server (not during build or on the client)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate environment variables early — fail fast if misconfigured
    try {
      const { getEnv } = await import("@/lib/env");
      getEnv();
      console.log("Environment variables validated");
    } catch (err) {
      console.error("FATAL: Environment validation failed:", err);
      // Don't throw — let the app start but individual features will fail
      // with clear error messages when they try to use missing vars.
    }

    try {
      const { startSlackApp } = await import("@/slack/app");
      await startSlackApp();
      console.log("Slack bot initialized");
    } catch (err) {
      console.error("Failed to start Slack bot:", err);
    }

    try {
      const { startWorkers } = await import("@/jobs/worker");
      startWorkers();
      console.log("Background workers started");
    } catch (err) {
      console.error("Failed to start workers:", err);
    }
  }
}
