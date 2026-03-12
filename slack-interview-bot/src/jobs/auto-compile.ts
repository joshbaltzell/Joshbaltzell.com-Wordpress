import { db } from "@/db";
import { projects, exchanges, participants, drafts } from "@/db/schema";
import { eq, and, lt, count } from "drizzle-orm";
import { compilationQueue } from "./queue";

/**
 * Periodic job that checks for projects past their deadline
 * and automatically triggers draft compilation.
 *
 * Conditions for auto-compile:
 * 1. Project status is "interviewing"
 * 2. Project has autoCompileOnDeadline enabled
 * 3. Project deadline has passed (or is within 1 hour)
 * 4. Project has at least 3 answered exchanges
 * 5. No draft has been compiled yet for this project
 *
 * Run this on a cron alongside schedule-nudges (e.g. every hour).
 */
export async function checkAutoCompile(): Promise<{
  triggered: number;
  checked: number;
}> {
  const now = new Date();
  // Check for deadlines in the past or within the next hour
  const threshold = new Date(now.getTime() + 60 * 60 * 1000);

  // Find interviewing projects with deadlines that have passed
  const candidates = await db.query.projects.findMany({
    where: and(
      eq(projects.status, "interviewing"),
      eq(projects.autoCompileOnDeadline, true),
      lt(projects.deadline, threshold)
    ),
  });

  let triggered = 0;

  for (const project of candidates) {
    // Skip if a draft already exists
    const existingDraft = await db.query.drafts.findFirst({
      where: eq(drafts.projectId, project.id),
    });
    if (existingDraft) continue;

    // Check if we have enough material (at least 3 answered exchanges)
    const [answered] = await db
      .select({ count: count() })
      .from(exchanges)
      .where(
        and(eq(exchanges.projectId, project.id), eq(exchanges.status, "answered"))
      );

    if ((answered?.count ?? 0) < 3) {
      console.log(
        `Auto-compile: Skipping "${project.title}" — only ${answered?.count ?? 0} answered exchanges (need 3+)`
      );
      continue;
    }

    // Mark any remaining "sent" exchanges as skipped (deadline passed)
    await db
      .update(exchanges)
      .set({ status: "skipped" })
      .where(
        and(eq(exchanges.projectId, project.id), eq(exchanges.status, "sent"))
      );

    // Mark active participants as completed (deadline passed)
    await db
      .update(participants)
      .set({ status: "completed" })
      .where(
        and(
          eq(participants.projectId, project.id),
          eq(participants.status, "active")
        )
      );

    // Enqueue compilation
    await compilationQueue.add(
      `auto-compile-${project.id}`,
      {
        projectId: project.id,
        triggeredBy: "deadline",
      },
      {
        // Deduplicate: only one auto-compile per project
        jobId: `auto-compile-${project.id}`,
      }
    );

    console.log(
      `Auto-compile: Triggered compilation for "${project.title}" (deadline: ${project.deadline?.toISOString()})`
    );
    triggered++;
  }

  return { triggered, checked: candidates.length };
}
