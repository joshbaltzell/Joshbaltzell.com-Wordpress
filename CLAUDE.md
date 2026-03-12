# Project Context for Claude

## Repository Overview

This repo (`Joshbaltzell.com-Wordpress`) contains Josh Baltzell's personal site and tooling:

| Directory | What It Is | Status |
|---|---|---|
| `wp-content/` | WordPress theme (`joshbaltzell`) and plugin (`jb-ai-interviewer`) for the personal site | Theme is functional with warm watercolor aesthetic. A Portavia-inspired redesign is planned (see plan file). |
| `slack-interview-bot/` | **Quotable** — AI-powered async Slack interview bot | Feature-complete v1. Ready for local testing. |
| `frame-recommender/` | ML recommendation engine for custom picture frames (Adobe Commerce) | Built and functional. |
| `content/` | Content files | |

---

## Quotable (slack-interview-bot/) — The Main Active Project

### What It Does
An editor creates an interview project in the web dashboard, adds Slack participants, and the bot conducts multi-person async interviews via DM. AI generates follow-up questions, cross-pollinates insights between participants, detects topic saturation, and compiles everything into a draft article with linked quotes.

### Tech Stack
- **Next.js 15** (App Router) — dashboard + API + Slack bot all in one process
- **TypeScript** throughout
- **PostgreSQL** + **Drizzle ORM** — 8 tables (projects, participants, questions, exchanges, follow_up_threads, drafts, draft_quote_refs, quote_approvals)
- **BullMQ** + **Redis** — 4 job queues (answer-processing, question-sending, nudge, compilation)
- **Slack Bolt.js** — Socket Mode (dev) / Events API (prod)
- **Google Gemini** — Flash for follow-ups/audits, Pro for draft compilation
- **Tailwind CSS** — custom component classes in globals.css

### Architecture — Single Process
Everything runs in one Next.js process via `src/instrumentation.ts`:
1. Validates env vars (Zod)
2. Starts Slack bot (Socket Mode in dev)
3. Starts BullMQ workers (answer processing, question sending, nudges, compilation)

There is **no separate worker process** needed.

### Local Development with Docker
```bash
cd slack-interview-bot
cp .env.example .env
# Fill in: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_APP_TOKEN, GEMINI_API_KEY, NEXTAUTH_SECRET
docker compose up --build
```
This starts Postgres 16, Redis 7, and the Next.js dev server. The start script (`scripts/start-dev.sh`) runs `drizzle-kit push` to sync the DB schema before launching Next.js. Source files are bind-mounted for hot reload.

### Key Files
| File | Purpose |
|---|---|
| `src/db/schema.ts` | Full Drizzle schema — all 8 tables |
| `src/db/relations.ts` | Drizzle relation definitions |
| `src/instrumentation.ts` | Server startup — env validation, Slack init, worker init |
| `src/slack/app.ts` | Slack Bolt initialization (Socket Mode auto-detected via SLACK_APP_TOKEN) |
| `src/slack/events.ts` | DM message handler — matches answers to pending exchanges |
| `src/slack/actions.ts` | Button handlers — accept/decline, quote approve/reject |
| `src/slack/commands.ts` | Slash commands — list, status, pause, resume |
| `src/slack/messages.ts` | Block Kit message builders for all Slack messages |
| `src/ai/followup.ts` | AI follow-up question generator |
| `src/ai/crosspoll.ts` | Cross-pollination engine |
| `src/ai/saturation.ts` | Topic saturation detector |
| `src/ai/compiler.ts` | 3-pass draft compiler (extraction → assembly → quote audit) |
| `src/ai/prompts.ts` | All prompt templates |
| `src/jobs/queue.ts` | BullMQ queue definitions + job type interfaces |
| `src/jobs/worker.ts` | Worker startup — registers all 4 workers |
| `src/jobs/process-answer.ts` | Pipeline: store answer → follow-ups → cross-poll → saturation check |
| `src/app/components/toast.tsx` | Global toast notification system (replaces all alert() calls) |
| `src/app/components/auto-refresh.tsx` | Client component that polls router.refresh() |
| `src/app/projects/[id]/project-actions.tsx` | Client component with confirmation dialogs for start/approve/publish |
| `docker-compose.yml` | Local dev: Postgres + Redis + app |
| `Dockerfile` | Dev Dockerfile (node:20-alpine) |
| `ARCHITECTURE.md` | Detailed architecture doc with prompts, schema, Slack flows |

### Database
- Uses `drizzle-kit push` for schema sync (not migration files in production)
- Migration SQL files exist in `src/db/migrations/` for reference
- Schema uses UUID primary keys, JSONB settings, enum columns
- Key tables: projects → participants → exchanges (the core Q&A pairs)

### Project Status Flow
`setup` → `interviewing` → `compiling` → `review` → `published`

### V1 Polish (Completed)
These features were added in the last session:
- Toast notifications (replacing all `alert()` calls)
- Auto-refresh polling (`router.refresh()` every 30s during active phases)
- Publish flow (review → published transition with confirmation)
- Confirmation dialogs on all destructive actions
- Skeleton loading states
- Mobile-responsive layouts
- Draft version comparison with paragraph-level diff

### Known Issues / Gotchas
1. **ioredis type mismatch**: bullmq bundles its own ioredis types. Both `queue.ts` and `worker.ts` use `as unknown as import("bullmq").ConnectionOptions` cast.
2. **TypeScript `never` in events.ts**: After Slack event narrowing guards, TS narrows to `never`. A typed alias `msg` is used to work around this.
3. **Build without DB**: `next build` fails trying to connect to Postgres/Redis for static generation. This is expected when running outside Docker. The app works fine in dev mode.
4. **DraftViewer receives `body` prop**: The allDrafts array passed to DraftViewer includes `body` but the client interface doesn't use it. The body is only used server-side for DiffView. Harmless extra serialization.

### What's NOT Done Yet (Future Work)
- End-to-end testing with a real Slack workspace (user needs to test locally)
- Slack OAuth flow for multi-workspace installs
- WordPress integration (push published articles to WP)
- Production deployment (Railway / Render / Fly.io recommended — NOT WP Engine)
- Real-time collaboration on draft editing
- Email fallback for non-Slack participants

---

## WordPress Theme (wp-content/themes/joshbaltzell/)

### Current State
Functional theme with warm watercolor aesthetic (cream/indigo/terracotta/sage/plum palette). Block theme using Full Site Editing.

### Planned Redesign
A Portavia-inspired redesign plan exists at `/root/.claude/plans/twinkly-hopping-otter.md`. Key changes planned:
- Oversized dramatic typography (display-large up to 8rem)
- Horizontal scrolling carousel for Featured Interviews
- Cinematic scroll animations (text reveal, clip reveal, scale-in)
- Transparent header overlay mode over hero sections
- Google Gemini Imagen integration for generating watercolor artwork

This redesign has NOT been started yet.

### Key Theme Files
- `theme.json` — design tokens (colors, fonts, spacing)
- `assets/css/custom.css` — custom styles + animations
- `assets/js/custom.js` — scroll animations, intersection observers
- `templates/` — block templates (front-page, single-ai_interview, archive, about, resume)
- `parts/` — header.html, footer.html
- `patterns/` — hero-watercolor.php, cta-newsletter.php

---

## WordPress Plugin (wp-content/plugins/jb-ai-interviewer/)

A single-person synchronous interview tool (different from Quotable which is multi-person async). Uses the WordPress editor to conduct interviews and generate articles. Has Gemini integration for question generation.

---

## Frame Recommender (frame-recommender/)

ML recommendation engine for Josh's custom picture framing business. Uses scikit-learn (NearestNeighbors + KMeans) with a FastAPI REST API. Pulls order data from Adobe Commerce.

---

## Git Workflow
- Main development branch for this work: `claude/wordpress-ai-interview-setup-G4cob`
- Always push with: `git push -u origin <branch-name>`
- Commit messages should be descriptive (what + why)

## Environment
- Docker is available on this machine
- Node.js and npm are available
- The slack-interview-bot has node_modules installed
