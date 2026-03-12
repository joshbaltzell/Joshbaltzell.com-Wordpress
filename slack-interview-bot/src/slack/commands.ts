import type { App } from "@slack/bolt";

/**
 * Register slash command handlers.
 * These are lightweight triggers — the real management happens in the dashboard.
 */
export function registerCommands(app: App): void {
  app.command("/interview", async ({ command, ack, respond }) => {
    await ack();

    const subcommand = command.text.trim().split(/\s+/)[0] || "help";

    switch (subcommand) {
      case "create":
        await respond({
          response_type: "ephemeral",
          text: `Create a new interview project in the dashboard: ${process.env.APP_URL}/projects/new`,
        });
        break;

      case "list":
        // TODO: Query active projects for this workspace and list them
        await respond({
          response_type: "ephemeral",
          text: `View all projects in the dashboard: ${process.env.APP_URL}`,
        });
        break;

      case "status": {
        const projectRef = command.text.trim().split(/\s+/)[1];
        if (!projectRef) {
          await respond({
            response_type: "ephemeral",
            text: "Usage: `/interview status <project-name>`",
          });
          break;
        }
        // TODO: Look up project and return status summary
        await respond({
          response_type: "ephemeral",
          text: `View project details: ${process.env.APP_URL}/projects`,
        });
        break;
      }

      case "pause":
        // TODO: Pause a project (stop sending questions)
        await respond({
          response_type: "ephemeral",
          text: "Project paused. No new questions will be sent until you `/interview resume`.",
        });
        break;

      case "resume":
        // TODO: Resume a paused project
        await respond({
          response_type: "ephemeral",
          text: "Project resumed. Questions will continue being sent.",
        });
        break;

      default:
        await respond({
          response_type: "ephemeral",
          text: [
            "*Interview Bot Commands:*",
            "`/interview create` — Create a new interview project",
            "`/interview list` — List active projects",
            "`/interview status <project>` — View project status",
            "`/interview pause <project>` — Pause question sending",
            "`/interview resume <project>` — Resume question sending",
            "",
            `Full dashboard: ${process.env.APP_URL}`,
          ].join("\n"),
        });
    }
  });
}
