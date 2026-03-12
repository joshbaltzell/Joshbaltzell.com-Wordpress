import Link from "next/link";
import { db } from "@/db";
import { projects, participants, exchanges } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";

const STATUS_BADGES: Record<string, { class: string; label: string }> = {
  setup: { class: "badge-gray", label: "Setup" },
  interviewing: { class: "badge-blue", label: "Interviewing" },
  compiling: { class: "badge-yellow", label: "Compiling" },
  review: { class: "badge-purple", label: "In Review" },
  published: { class: "badge-green", label: "Published" },
};

async function getProjects() {
  const allProjects = await db.query.projects.findMany({
    orderBy: (projects, { desc }) => [desc(projects.createdAt)],
  });

  // Get participant and exchange counts per project
  const stats = await Promise.all(
    allProjects.map(async (project) => {
      const [participantCount] = await db
        .select({ count: count() })
        .from(participants)
        .where(eq(participants.projectId, project.id));
      const [exchangeCount] = await db
        .select({ count: count() })
        .from(exchanges)
        .where(eq(exchanges.projectId, project.id));
      const [answeredCount] = await db
        .select({ count: count() })
        .from(exchanges)
        .where(
          and(eq(exchanges.projectId, project.id), eq(exchanges.status, "answered"))
        );

      return {
        ...project,
        participantCount: participantCount?.count ?? 0,
        exchangeCount: exchangeCount?.count ?? 0,
        answeredCount: answeredCount?.count ?? 0,
      };
    })
  );

  return stats;
}

export default async function ProjectsPage() {
  const projectList = await getProjects();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your interview projects
          </p>
        </div>
        <Link href="/projects/new" className="btn-primary">
          New Project
        </Link>
      </div>

      {projectList.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 mb-4">No projects yet</p>
          <Link href="/projects/new" className="btn-primary">
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projectList.map((project) => {
            const badge = STATUS_BADGES[project.status] ?? STATUS_BADGES.setup;
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="card p-5 hover:border-brand-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-gray-900 truncate">
                        {project.title}
                      </h2>
                      <span className={badge.class}>{badge.label}</span>
                    </div>
                    {project.thesis && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                        {project.thesis}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-sm text-gray-500 ml-4">
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">
                        {project.participantCount}
                      </div>
                      <div>participants</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">
                        {project.answeredCount}/{project.exchangeCount}
                      </div>
                      <div>answered</div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
