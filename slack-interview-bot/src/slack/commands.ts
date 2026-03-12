import type { App } from "@slack/bolt";
import { db } from "@/db";
import { projects, participants, exchanges, drafts } from "@/db/schema";
import { eq, and, count, ilike } from "drizzle-orm";
import { buildProgressMessage } from "./messages";

/**
 * Register slash command handlers.
 */
export function registerCommands(app: App): void {
  app.command("/quotable", async ({ command, ack, respond }) => {
    await ack();

    const subcommand = command.text.trim().split(/\s+/)[0] || "help";

    switch (subcommand) {
      case "create":
        await respond({
          response_type: "ephemeral",
          text: `:speech_balloon: Create a new project in the Quotable dashboard: ${process.env.APP_URL}/projects/new`,
        });
        break;

      case "list": {
        try {
          const editorProjects = await db.query.projects.findMany({
            where: eq(projects.editorSlackUserId, command.user_id),
          });
          if (editorProjects.length === 0) {
            await respond({
              response_type: "ephemeral",
              text: "You don't have any projects yet. Create one with `/quotable create`.",
            });
          } else {
            const lines = editorProjects.map((p) => {
              const statusEmoji =
                p.status === "published" ? ":green_book:" :
                p.status === "review" ? ":eyes:" :
                p.status === "interviewing" ? ":speech_balloon:" :
                p.status === "compiling" ? ":gear:" :
                ":pencil:";
              return `${statusEmoji} *${p.title}* — ${p.status}`;
            });
            await respond({
              response_type: "ephemeral",
              text: `*:speech_balloon: Your Quotable projects:*\n${lines.join("\n")}\n\nFull dashboard: ${process.env.APP_URL}`,
            });
          }
        } catch (err) {
          console.error("Failed to list projects:", err);
          await respond({
            response_type: "ephemeral",
            text: `:speech_balloon: View all projects: ${process.env.APP_URL}`,
          });
        }
        break;
      }

      case "status": {
        const projectRef = command.text.trim().split(/\s+/).slice(1).join(" ");
        if (!projectRef) {
          await respond({
            response_type: "ephemeral",
            text: "Usage: `/quotable status <project-name>`",
          });
          break;
        }

        try {
          // Search for a matching project by title (fuzzy)
          const project = await db.query.projects.findFirst({
            where: and(
              eq(projects.editorSlackUserId, command.user_id),
              ilike(projects.title, `%${projectRef}%`)
            ),
          });

          if (!project) {
            await respond({
              response_type: "ephemeral",
              text: `Couldn't find a project matching "${projectRef}". Try \`/quotable list\` to see your projects.`,
            });
            break;
          }

          // Build full progress
          const projectParticipants = await db.query.participants.findMany({
            where: eq(participants.projectId, project.id),
          });

          const participantStats = await Promise.all(
            projectParticipants.map(async (p) => {
              const [answered] = await db
                .select({ count: count() })
                .from(exchanges)
                .where(
                  and(eq(exchanges.participantId, p.id), eq(exchanges.status, "answered"))
                );
              const [total] = await db
                .select({ count: count() })
                .from(exchanges)
                .where(eq(exchanges.participantId, p.id));
              return {
                name: p.name,
                status: p.status,
                answered: answered?.count ?? 0,
                total: total?.count ?? 0,
              };
            })
          );

          const totalAnswered = participantStats.reduce((s, p) => s + p.answered, 0);
          const totalExchanges = participantStats.reduce((s, p) => s + p.total, 0);

          const latestDraft = await db.query.drafts.findFirst({
            where: eq(drafts.projectId, project.id),
            orderBy: (d, { desc }) => [desc(d.version)],
          });

          const saturation = (project.settings as any)?.latestSaturation ?? null;
          let daysRemaining: number | null = null;
          if (project.deadline) {
            daysRemaining = Math.ceil(
              (new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
          }

          const blocks = buildProgressMessage({
            projectTitle: project.title,
            status: project.status,
            participantSummary: participantStats,
            totalAnswered,
            totalExchanges,
            saturationReady: saturation?.readyToDraft ?? false,
            saturationScores: saturation?.scores ?? null,
            deadline: project.deadline
              ? new Date(project.deadline).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null,
            daysRemaining,
            latestDraftVersion: latestDraft?.version ?? null,
            dashboardUrl: `${process.env.APP_URL}/projects/${project.id}`,
          });

          await respond({
            response_type: "ephemeral",
            blocks,
            text: `Progress for "${project.title}"`,
          });
        } catch (err) {
          console.error("Failed to get project status:", err);
          await respond({
            response_type: "ephemeral",
            text: `:warning: Something went wrong. Try the dashboard: ${process.env.APP_URL}`,
          });
        }
        break;
      }

      case "pause": {
        const pauseRef = command.text.trim().split(/\s+/).slice(1).join(" ");
        if (!pauseRef) {
          await respond({
            response_type: "ephemeral",
            text: "Usage: `/quotable pause <project-name>`",
          });
          break;
        }
        try {
          const pauseProject = await db.query.projects.findFirst({
            where: and(
              eq(projects.editorSlackUserId, command.user_id),
              ilike(projects.title, `%${pauseRef}%`)
            ),
          });
          if (!pauseProject) {
            await respond({
              response_type: "ephemeral",
              text: `Couldn't find a project matching "${pauseRef}". Try \`/quotable list\`.`,
            });
          } else if (pauseProject.status !== "interviewing") {
            await respond({
              response_type: "ephemeral",
              text: `:warning: "${pauseProject.title}" is in *${pauseProject.status}* — only interviewing projects can be paused.`,
            });
          } else {
            await db
              .update(projects)
              .set({
                settings: {
                  ...((pauseProject.settings as Record<string, unknown>) || {}),
                  paused: true,
                  pausedAt: new Date().toISOString(),
                },
                updatedAt: new Date(),
              })
              .where(eq(projects.id, pauseProject.id));
            await respond({
              response_type: "ephemeral",
              text: `:pause_button: *"${pauseProject.title}"* paused. No new questions until \`/quotable resume ${pauseRef}\`.`,
            });
          }
        } catch (err) {
          console.error("Failed to pause project:", err);
          await respond({ response_type: "ephemeral", text: ":warning: Something went wrong." });
        }
        break;
      }

      case "resume": {
        const resumeRef = command.text.trim().split(/\s+/).slice(1).join(" ");
        if (!resumeRef) {
          await respond({
            response_type: "ephemeral",
            text: "Usage: `/quotable resume <project-name>`",
          });
          break;
        }
        try {
          const resumeProject = await db.query.projects.findFirst({
            where: and(
              eq(projects.editorSlackUserId, command.user_id),
              ilike(projects.title, `%${resumeRef}%`)
            ),
          });
          if (!resumeProject) {
            await respond({
              response_type: "ephemeral",
              text: `Couldn't find a project matching "${resumeRef}".`,
            });
          } else if (!(resumeProject.settings as any)?.paused) {
            await respond({
              response_type: "ephemeral",
              text: `*"${resumeProject.title}"* isn't paused.`,
            });
          } else {
            const { paused, pausedAt, ...restSettings } =
              (resumeProject.settings as Record<string, unknown>) || {};
            await db
              .update(projects)
              .set({ settings: restSettings, updatedAt: new Date() })
              .where(eq(projects.id, resumeProject.id));
            await respond({
              response_type: "ephemeral",
              text: `:arrow_forward: *"${resumeProject.title}"* resumed! Questions will continue.`,
            });
          }
        } catch (err) {
          console.error("Failed to resume project:", err);
          await respond({ response_type: "ephemeral", text: ":warning: Something went wrong." });
        }
        break;
      }

      default:
        await respond({
          response_type: "ephemeral",
          text: [
            "*:speech_balloon: Quotable Commands:*",
            "`/quotable create` — Create a new interview project",
            "`/quotable list` — List active projects",
            "`/quotable status <project>` — View project status & progress",
            "`/quotable pause <project>` — Pause question sending",
            "`/quotable resume <project>` — Resume question sending",
            "",
            `Full dashboard: ${process.env.APP_URL}`,
          ].join("\n"),
        });
    }
  });
}
