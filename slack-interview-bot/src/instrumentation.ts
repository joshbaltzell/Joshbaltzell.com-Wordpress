/**
 * Next.js instrumentation hook — runs once when the server starts.
 * We use this to initialize the Slack bot and background workers.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the server (not during build or on the client)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSlackApp } = await import("@/slack/app");
    const { startWorkers } = await import("@/jobs/worker");

    try {
      await startSlackApp();
      console.log("Slack bot initialized");
    } catch (err) {
      console.error("Failed to start Slack bot:", err);
    }

    try {
      startWorkers();
      console.log("Background workers started");
    } catch (err) {
      console.error("Failed to start workers:", err);
    }
  }
}
