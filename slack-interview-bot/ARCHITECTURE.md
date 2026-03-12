# Slack Interview Bot — Architecture

## Overview

An AI-powered async interview system that lives in Slack. An **editor** creates an interview project, assigns **participants**, and a bot conducts interviews via DM — generating follow-ups, cross-pollinating insights between participants, nudging non-responders, and compiling everything into a draft article.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Editor UI | Standalone web dashboard | Rich UI for managing projects, reviewing quotes, editing drafts |
| AI Provider | Google Gemini | Already in use for image generation; strong long-context capabilities |
| WordPress integration | Standalone (for now) | Simpler to build; WP push can be added later |
| Runtime | Node.js + TypeScript | Slack Bolt.js is the official SDK; TypeScript for safety |
| Database | PostgreSQL | Relational data (projects → participants → exchanges); great JSON support |
| Hosting | Railway / Render / Fly.io | Needs persistent process for Slack; separate from WPEngine |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        EDITOR DASHBOARD                          │
│                     (Next.js web app)                            │
│                                                                  │
│  Create Projects · Assign Participants · Review Quotes           │
│  Approve/Reject AI Questions · Edit Drafts · Publish             │
├──────────────────────────────────────────────────────────────────┤
│                         REST API                                 │
│                    (Next.js API routes)                          │
├──────────┬──────────┬──────────┬────────────┬───────────────────┤
│          │          │          │            │                   │
│  Project │ Particip │ Exchange │ AI Intel   │  Draft            │
│  CRUD    │ Mgmt     │ History  │ Layer      │  Compiler         │
│          │          │          │            │                   │
├──────────┴──────────┴──────────┴────────────┴───────────────────┤
│                       DATABASE (PostgreSQL)                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    SLACK BOT (Bolt.js)                           │
│                                                                  │
│  Receives DM replies · Sends questions · Nudges · Rich messages │
│  Socket Mode (dev) · Events API (prod)                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                  BACKGROUND WORKERS (BullMQ)                    │
│                                                                  │
│  Follow-up Generator · Cross-Pollinator · Saturation Checker    │
│  Nudge Scheduler · Draft Compiler                               │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                    EXTERNAL SERVICES                             │
│  Google Gemini API · Slack API · (future: WordPress REST API)   │
└──────────────────────────────────────────────────────────────────┘
```

### Key Insight: Single Deployable

The dashboard, Slack bot, and background workers all run in a single Node.js process (or two: web + worker). This keeps things simple for v1. The Next.js app serves the dashboard AND runs the Slack bot on startup.

---

## Technology Stack

| Layer | Technology | Why |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Dashboard + API in one package; great DX |
| **Language** | TypeScript | Type safety across bot, API, and dashboard |
| **Slack SDK** | `@slack/bolt` + `@slack/web-api` | Official Slack SDK; Socket Mode for dev |
| **AI** | `@google/generative-ai` (Gemini SDK) | Question generation, follow-ups, cross-pollination, draft compilation |
| **Database** | PostgreSQL + Drizzle ORM | Type-safe queries; great migration story |
| **Job Queue** | BullMQ + Redis | Reliable background jobs (follow-ups, nudges, compilation) |
| **Auth** | NextAuth.js with Slack OAuth | Editor logs in with Slack; knows their workspace |
| **UI** | Tailwind CSS + shadcn/ui | Fast to build, good-looking dashboard |
| **Deployment** | Railway (or Render) | Easy PostgreSQL + Redis + Node.js hosting |

---

## Database Schema

### Entity Relationship

```
projects ──1:N── participants
projects ──1:N── questions
projects ──1:N── drafts

participants ──1:N── exchanges
questions ──1:N── exchanges

exchanges ──1:N── follow_up_threads (as parent)
exchanges ──1:N── follow_up_threads (as child)

drafts ──1:N── draft_quote_refs
exchanges ──1:N── draft_quote_refs
```

### Tables

#### `projects`
The central entity. One project = one article being produced.

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | |
| title | TEXT | Article working title |
| thesis | TEXT | Editorial angle / thesis statement |
| target_audience | TEXT | Who this article is for |
| status | ENUM | `setup` → `interviewing` → `compiling` → `review` → `published` |
| target_word_count | INT | Target article length |
| editor_slack_user_id | TEXT | Slack user ID of the editor |
| workspace_id | TEXT | Slack workspace/team ID |
| settings | JSONB | Per-project overrides (model, temperature, max rounds, etc.) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `participants`
People being interviewed for a project.

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | |
| project_id | UUID (FK) | |
| slack_user_id | TEXT | Their Slack user ID |
| name | TEXT | Display name |
| title | TEXT | Job title |
| role | ENUM | `editor` / `interviewee` / `reviewer` |
| context | TEXT | Why they're included (fed to AI for relevant questions) |
| status | ENUM | `pending` / `active` / `completed` / `declined` |
| dm_channel_id | TEXT | Slack DM channel ID (cached after first open) |
| last_nudge_at | TIMESTAMPTZ | When we last sent a reminder |
| created_at | TIMESTAMPTZ | |

#### `questions`
Question bank — both seed questions and AI-generated ones.

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | |
| project_id | UUID (FK) | |
| text | TEXT | The question |
| origin | ENUM | `manual` / `ai_followup` / `ai_crosspoll` |
| source_exchange_id | UUID (FK, nullable) | Which exchange triggered this AI question |
| source_participant_ids | UUID[] | For cross-poll: whose answers inspired this |
| priority | ENUM | `high` / `medium` / `low` |
| approved | BOOLEAN | Editor has approved this question (default: true for manual, configurable for AI) |
| created_at | TIMESTAMPTZ | |

#### `exchanges`
The core Q&A pairs — every question asked and answer received.

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | |
| project_id | UUID (FK) | |
| participant_id | UUID (FK) | |
| question_id | UUID (FK) | |
| answer_text | TEXT | Verbatim answer (nullable until answered) |
| sequence | INT | Order within this participant's interview |
| status | ENUM | `pending` / `sent` / `answered` / `skipped` |
| slack_message_ts | TEXT | Slack message timestamp (for threading) |
| asked_at | TIMESTAMPTZ | When the bot sent this question |
| answered_at | TIMESTAMPTZ | When the participant replied |
| created_at | TIMESTAMPTZ | |

#### `follow_up_threads`
Links exchanges in conversation threads and cross-pollination chains.

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | |
| project_id | UUID (FK) | |
| parent_exchange_id | UUID (FK) | The exchange that triggered this |
| child_exchange_id | UUID (FK) | The resulting follow-up exchange |
| relationship | ENUM | `followup` / `crosspoll` / `clarification` |
| rationale | TEXT | AI's reasoning for generating this question |
| created_at | TIMESTAMPTZ | |

#### `drafts`
Compiled article drafts (versioned).

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | |
| project_id | UUID (FK) | |
| version | INT | Draft version number |
| title | TEXT | Draft article title |
| body | TEXT | Full article text with [QUOTE_ID:xxx] markers |
| body_html | TEXT | Rendered HTML version |
| thematic_analysis | JSONB | Output from extraction pass (themes, quote clusters) |
| model_used | TEXT | Which Gemini model produced this |
| created_at | TIMESTAMPTZ | |

#### `draft_quote_refs`
Links every quote used in a draft back to its source exchange.

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | |
| draft_id | UUID (FK) | |
| exchange_id | UUID (FK) | |
| quote_snippet | TEXT | The exact text used |
| location_hint | TEXT | Where in the draft (e.g., "paragraph 3") |
| editor_included | BOOLEAN | Editor chose to keep this quote (default: true) |
| editor_excluded | BOOLEAN | Editor explicitly removed this quote |
| created_at | TIMESTAMPTZ | |

---

## Slack Bot Design

### Slash Commands

| Command | Description |
|---|---|
| `/interview create` | Opens modal to create a new project |
| `/interview list` | Lists active projects in the workspace |
| `/interview status <project>` | Shows project status summary |
| `/interview pause <project>` | Pauses all outgoing messages for a project |
| `/interview resume <project>` | Resumes a paused project |

These are lightweight triggers — the real management happens in the web dashboard.

### Message Flows

#### 1. Initial Outreach (Bot → Participant DM)

```
┌─────────────────────────────────────────────────┐
│ 👋 Hi Sarah! I'm helping Josh put together an   │
│ article about "Why platform migrations fail."    │
│                                                  │
│ Josh thought you'd have great perspective given  │
│ your experience leading the Acme Corp migration. │
│                                                  │
│ I'll ask you 6-10 questions over the next few    │
│ days. Reply whenever it's convenient — no rush.  │
│                                                  │
│ Ready to start?                                  │
│                                                  │
│ [Let's go]  [Not right now]  [Decline]          │
└─────────────────────────────────────────────────┘
```

#### 2. Question (Bot → Participant DM)

```
┌─────────────────────────────────────────────────┐
│ Question 3 of ~8                                │
│                                                  │
│ You mentioned data migration wasn't prioritized  │
│ until month 6. What do you think caused that     │
│ delay — was it a planning oversight or were      │
│ there competing priorities?                      │
│                                                  │
│ 💡 Just reply to this message with your answer.  │
│    Take as much space as you need.               │
│                                                  │
│ [Skip this question]                            │
└─────────────────────────────────────────────────┘
```

#### 3. Nudge (Bot → Participant DM, after 48hrs)

```
┌─────────────────────────────────────────────────┐
│ Hey Sarah — just a friendly follow-up on the     │
│ question I sent Tuesday. No rush, but wanted to  │
│ make sure it didn't get buried.                  │
│                                                  │
│ If the question doesn't resonate, I can ask a   │
│ different one instead.                           │
│                                                  │
│ [Answer now]  [Ask me something else]  [Done]   │
└─────────────────────────────────────────────────┘
```

#### 4. Editor Notification (Bot → Editor DM)

```
┌─────────────────────────────────────────────────┐
│ 📋 Project Update: "Platform Migration Failures" │
│                                                  │
│ Sarah Chen just answered question 3.             │
│ ───────────────────                              │
│ "The real problem was that nobody owned the data │
│ migration workstream. It fell between the        │
│ platform team and the data team..."              │
│ ───────────────────                              │
│                                                  │
│ 🤖 I generated 2 follow-up questions and 1      │
│    cross-pollination question for Mike.          │
│                                                  │
│ [View in Dashboard]  [Approve questions]        │
└─────────────────────────────────────────────────┘
```

### Event Handling

| Slack Event | Bot Action |
|---|---|
| `message.im` (DM reply) | Match to pending exchange → store answer → trigger follow-up generator |
| `block_actions` (button click) | Handle "Let's go", "Skip", "Ask me something else", etc. |
| `shortcut` / `command` | Handle slash commands |
| `member_joined_channel` | (future) Auto-suggest participants |

---

## AI Intelligence Layer (Gemini)

### Model Selection

| Task | Model | Temperature | Why |
|---|---|---|---|
| Follow-up questions | `gemini-2.0-flash` | 0.4 | Fast, cheap, good enough for questions |
| Cross-pollination | `gemini-2.0-pro` | 0.3 | Needs to compare multiple participants |
| Saturation check | `gemini-2.0-flash` | 0.1 | Analytical scoring task |
| Draft compilation | `gemini-2.0-pro` | 0.2 | Long-form writing with quote fidelity |
| Quote fidelity audit | `gemini-2.0-flash` | 0.0 | Exact comparison task |

### Pipeline: What Happens After Each Answer

```
Participant answers question
         │
         ▼
   ┌─────────────────┐
   │ Store exchange   │
   │ (status=answered)│
   └────────┬────────┘
            │
   ┌────────▼────────┐    ┌──────────────────────┐
   │ Follow-Up       │───▶│ 0-3 new questions    │
   │ Generator       │    │ (origin=ai_followup) │
   │ (BullMQ job)    │    └──────────────────────┘
   └────────┬────────┘
            │
   ┌────────▼────────┐    ┌──────────────────────────┐
   │ Cross-Pollinator│───▶│ Questions for OTHER      │
   │ (if 3+ answers  │    │ participants about themes │
   │  exist across   │    │ this person raised        │
   │  participants)  │    │ (origin=ai_crosspoll)     │
   └────────┬────────┘    └──────────────────────────┘
            │
   ┌────────▼────────┐    ┌──────────────────────┐
   │ Saturation      │───▶│ Score + gaps report   │
   │ Checker         │    │ (every 5 exchanges)   │
   │ (periodic)      │    └──────────────────────┘
            │
   ┌────────▼────────┐
   │ Question Router │───▶ Pick next question for participant
   │                 │     (priority: high AI followup > manual > medium > crosspoll)
   │                 │     Check if editor approval needed
   │                 │     Send via Slack DM
   └─────────────────┘
```

### Auto-Approval vs Editor-Approval

Configurable per project:

| Mode | Behavior |
|---|---|
| `auto` (default) | High-priority follow-ups sent immediately. Cross-poll questions queued for editor review. |
| `editor_approves_all` | All AI-generated questions require editor approval before sending. |
| `full_auto` | Everything sends automatically. Editor gets notified but doesn't block. |

### Follow-Up Generator Prompt

```
You are an investigative interviewer gathering material for an article.

ARTICLE THESIS: {thesis}
TARGET AUDIENCE: {audience}

THIS PARTICIPANT: {name}, {title}
CONTEXT: {why they're included}

THEIR CONVERSATION SO FAR:
{formatted exchanges}

LATEST EXCHANGE:
Q: {question}
A: "{answer}"

Generate 0-3 follow-up questions. For each, provide:
- The question text
- A brief rationale (why this matters for the article)
- Priority: "high" (essential gap), "medium" (interesting thread), "low" (nice to have)

Rules:
- Only generate questions if the answer opens genuinely interesting threads
- Don't ask for clarification on things that are already clear
- Prefer "why" and "how" questions over "what" questions
- Keep questions conversational, not interrogative
- Return empty array if no follow-up needed

Return JSON array only.
```

### Cross-Pollination Prompt

```
You are analyzing interview responses across multiple participants for an article.

ARTICLE THESIS: {thesis}

PARTICIPANT RESPONSES BY THEME:
{all exchanges grouped by AI-identified themes}

PARTICIPANT WHO JUST ANSWERED: {name}
THEMES THEY TOUCHED ON: {themes from their answers}

For each theme this participant raised, identify other participants
who HAVEN'T been asked about it yet. Generate a question for each
uncovered participant that explores the same theme from their perspective.

Rules:
- Do NOT reveal what other participants said (no "Sarah mentioned...")
- Frame questions around the theme, not the specific quote
- Only generate questions where the participant's context suggests they'd have relevant input
- Maximum 2 cross-pollination questions per answer event

Return JSON: [{"participant_id": "...", "question": "...", "theme": "...", "rationale": "..."}]
```

### Saturation Detector Prompt

```
You are an editorial analyst assessing whether enough interview material
has been collected to write a compelling article.

ARTICLE THESIS: {thesis}
TARGET WORD COUNT: {target} words
TARGET AUDIENCE: {audience}

ALL EXCHANGES COLLECTED:
{formatted with participant names and exchange IDs}

Score each dimension 1-5:
1. THESIS COVERAGE: Enough material to support the thesis?
2. SOURCE DIVERSITY: Multiple perspectives represented?
3. QUOTE QUALITY: Compelling, quotable moments?
4. COUNTERPOINT: Dissenting or nuanced views present?
5. NARRATIVE ARC: Material supports a beginning, middle, conclusion?

Also identify:
- GAPS: What's missing? What questions remain unanswered?
- STRONGEST QUOTES: Top 5 most article-worthy quotes (with exchange IDs)
- RECOMMENDED NEXT: Specific questions to ask specific participants

Return JSON with scores, gaps, strongest_quotes, recommended_next, and ready_to_draft (boolean).
Set ready_to_draft=true only if ALL scores >= 3 and at least three are >= 4.
```

### Draft Compiler (Two-Pass)

**Pass 1 — Thematic Extraction:**
```
Analyze these interview exchanges for an article about "{thesis}".

EXCHANGES:
{all exchanges with IDs and participant attribution}

Tasks:
1. Identify 4-7 thematic threads that run through the interviews
2. For each thread, list the relevant quotes (exact text) with [EXCHANGE_ID] markers
3. Flag contradictions or tensions between participants
4. Suggest a narrative arc (how to order the themes)

Return structured JSON.
```

**Pass 2 — Draft Assembly:**
```
Write a {target_word_count}-word article using the thematic analysis and raw exchanges below.

ARTICLE TITLE: {title}
THESIS: {thesis}
AUDIENCE: {audience}

THEMATIC ANALYSIS:
{output from pass 1}

RAW EXCHANGES (for exact quote wording):
{all exchanges with IDs}

Rules:
- Every quote must be EXACTLY as it appears in the raw exchanges — no paraphrasing inside quotation marks
- Mark every quote with [QUOTE_ID:{exchange_id}] immediately after the closing quotation mark
- Attribute quotes to participants by name and title
- Where participants disagree, present both perspectives
- Insert [EDITOR_CHOICE: option A | option B] where two similar quotes could work and the editor should pick
- Insert [EDITOR_NOTE: ...] where you need editorial judgment
- Write in a professional but accessible tone
- Include an introduction that sets up the thesis and a conclusion that synthesizes insights
```

**Pass 3 — Quote Fidelity Audit:**
```
Compare every quoted string in the draft against the raw exchanges.
Flag ANY quote that differs from its source by even one word.

DRAFT:
{draft text}

RAW EXCHANGES:
{all exchanges}

Return JSON array of mismatches: [{"quote_in_draft": "...", "source_text": "...", "exchange_id": "...", "issue": "..."}]
Return empty array if all quotes match exactly.
```

---

## Editor Dashboard (Next.js)

### Pages

| Route | Purpose |
|---|---|
| `/` | Project list — cards showing each project with status, participant count, exchange count |
| `/projects/new` | Create new project (title, thesis, audience, word count) |
| `/projects/[id]` | Project overview — status, participants, saturation scores, timeline |
| `/projects/[id]/participants` | Manage participants — add/remove, see their progress, conversation history |
| `/projects/[id]/exchanges` | All exchanges in a filterable, searchable list — grouped by participant or by theme |
| `/projects/[id]/questions` | Question queue — pending AI questions needing approval, with approve/reject/edit |
| `/projects/[id]/quotes` | Quote browser — all quotes tagged by theme, with star/include/exclude toggles |
| `/projects/[id]/draft` | Draft editor — compiled article with inline [QUOTE_ID] links, editor notes, and revision history |
| `/settings` | Workspace settings — API keys, default preferences, Slack connection |

### Key UI Components

**Project Overview Card:**
- Status badge (interviewing / compiling / review)
- Participant avatars with progress rings
- Saturation radar chart (5 dimensions)
- "Compile Draft" button (enabled when saturation check passes)

**Exchange Timeline:**
- Chronological feed of all exchanges across all participants
- Color-coded by participant
- Expandable to show follow-up chain
- "This inspired a cross-poll question to Mike" annotations

**Quote Browser:**
- Grid of quote cards
- Filter by participant, theme, starred/included/excluded
- Drag to reorder within themes
- One-click "include in draft" / "exclude from draft"
- Shows which draft paragraphs currently use each quote

**Draft Editor:**
- Rich text view of compiled draft
- Inline highlights on quotes — click to see source exchange
- [EDITOR_CHOICE] sections render as A/B toggle cards
- [EDITOR_NOTE] sections render as yellow callout boxes
- "Regenerate section" button per section
- Version history sidebar

---

## Folder Structure

```
slack-interview-bot/
├── ARCHITECTURE.md              ← This document
├── package.json
├── tsconfig.json
├── drizzle.config.ts            ← Drizzle ORM config
├── .env.example
│
├── src/
│   ├── app/                     ← Next.js App Router (dashboard)
│   │   ├── layout.tsx
│   │   ├── page.tsx             ← Project list
│   │   ├── projects/
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx     ← Project overview
│   │   │       ├── participants/page.tsx
│   │   │       ├── exchanges/page.tsx
│   │   │       ├── questions/page.tsx
│   │   │       ├── quotes/page.tsx
│   │   │       └── draft/page.tsx
│   │   ├── settings/page.tsx
│   │   └── api/                 ← API routes
│   │       ├── projects/route.ts
│   │       ├── projects/[id]/route.ts
│   │       ├── projects/[id]/participants/route.ts
│   │       ├── projects/[id]/exchanges/route.ts
│   │       ├── projects/[id]/questions/route.ts
│   │       ├── projects/[id]/compile/route.ts
│   │       ├── projects/[id]/draft/route.ts
│   │       └── slack/events/route.ts   ← Slack Events API webhook
│   │
│   ├── slack/                   ← Slack bot logic
│   │   ├── app.ts              ← Bolt.js app initialization
│   │   ├── commands.ts         ← Slash command handlers
│   │   ├── events.ts           ← Message event handlers
│   │   ├── actions.ts          ← Button/interaction handlers
│   │   ├── messages.ts         ← Block Kit message builders
│   │   └── middleware.ts       ← Auth, logging, etc.
│   │
│   ├── ai/                     ← AI intelligence layer
│   │   ├── client.ts           ← Gemini client setup
│   │   ├── followup.ts         ← Follow-up question generator
│   │   ├── crosspoll.ts        ← Cross-pollination engine
│   │   ├── saturation.ts       ← Saturation detector
│   │   ├── compiler.ts         ← Draft compiler (3-pass)
│   │   └── prompts.ts          ← All prompt templates
│   │
│   ├── jobs/                   ← Background job definitions
│   │   ├── queue.ts            ← BullMQ queue setup
│   │   ├── worker.ts           ← Job worker (processes jobs)
│   │   ├── process-answer.ts   ← Triggered when participant answers
│   │   ├── send-question.ts    ← Sends next question via Slack
│   │   ├── nudge.ts            ← Sends reminder after timeout
│   │   ├── check-saturation.ts ← Periodic saturation check
│   │   └── compile-draft.ts    ← Draft compilation job
│   │
│   ├── db/                     ← Database layer
│   │   ├── index.ts            ← Drizzle client
│   │   ├── schema.ts           ← Drizzle schema definitions
│   │   └── migrations/         ← SQL migration files
│   │       └── 0001_initial.sql
│   │
│   ├── lib/                    ← Shared utilities
│   │   ├── env.ts              ← Environment variable validation
│   │   └── types.ts            ← Shared TypeScript types
│   │
│   └── components/             ← React components (dashboard)
│       ├── ui/                 ← shadcn/ui components
│       ├── project-card.tsx
│       ├── exchange-timeline.tsx
│       ├── quote-browser.tsx
│       ├── draft-editor.tsx
│       ├── saturation-chart.tsx
│       └── participant-avatar.tsx
│
├── public/                     ← Static assets
└── drizzle/                    ← Generated migration artifacts
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal: Bot can send a question and receive an answer**

1. Next.js project setup with TypeScript, Tailwind, shadcn/ui
2. PostgreSQL database + Drizzle schema + initial migration
3. Slack app creation (bot token, Socket Mode for dev)
4. Basic Slack bot — receives DMs, sends messages
5. Project CRUD API + simple dashboard list/create pages
6. Add participants to a project (by Slack user ID)
7. Send first question to participant via DM
8. Receive answer, store as exchange

**Deliverable:** Editor creates project in dashboard, adds participants, bot sends one question to each, answers come back and are stored.

### Phase 2: Interview Intelligence (Week 3-4)
**Goal: Bot conducts smart multi-round interviews**

1. Gemini integration for follow-up generation
2. Question routing — pick next question, send it
3. Follow-up chain tracking (follow_up_threads)
4. Cross-pollination engine
5. Saturation detector (run every 5 exchanges)
6. Editor question approval queue in dashboard
7. Configurable auto-approval modes

**Deliverable:** Bot conducts full 8-12 round interviews with AI-generated follow-ups and cross-pollination.

### Phase 3: Nudging & Lifecycle (Week 5)
**Goal: Bot handles real-world async behavior**

1. BullMQ job queue for scheduled tasks
2. Nudge scheduler — remind after configurable timeout (default 48hrs)
3. Nudge escalation — different message after 2nd and 3rd nudge
4. "Skip this question" / "Ask me something else" participant controls
5. Participant completion — "I'm done" flow
6. Project pause/resume
7. Editor notifications in Slack (new answers, saturation milestones)

**Deliverable:** Bot handles participants who are slow, unresponsive, or want to skip questions.

### Phase 4: Draft Compilation (Week 6-7)
**Goal: All material compiled into an editable article**

1. Three-pass draft compiler (extraction → assembly → audit)
2. Draft storage with version history
3. Quote reference tracking (draft_quote_refs)
4. Quote browser UI in dashboard
5. Draft editor UI with inline quote links
6. Editor choice resolution ([EDITOR_CHOICE] → pick A or B)
7. Section-level regeneration
8. Export as Markdown, HTML, or plain text

**Deliverable:** Editor clicks "compile", gets a draft article with linked quotes they can edit and refine.

### Phase 5: Polish & Deploy (Week 8)
**Goal: Production-ready**

1. Slack OAuth flow (install to any workspace)
2. NextAuth.js authentication
3. Error handling, retry logic, graceful degradation
4. Rate limiting (Gemini API, Slack API)
5. Production deployment (Railway/Render)
6. Environment configuration and secrets management
7. Basic analytics (exchanges per project, response times, etc.)

### Future Phases
- WordPress integration (push published articles to WP)
- Multi-workspace support
- Email fallback for non-Slack participants
- Voice memo transcription (Slack audio messages)
- Real-time collaboration on draft editing
- Template library (reusable question sets for common article types)

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/interview_bot

# Redis (for BullMQ)
REDIS_URL=redis://host:6379

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...  # For Socket Mode (dev)

# Google Gemini
GEMINI_API_KEY=...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://your-app.railway.app

# App
NODE_ENV=development
APP_URL=https://your-app.railway.app
```

---

## Slack App Configuration

### Required Bot Token Scopes
- `chat:write` — Send messages
- `im:write` — Open DM channels
- `im:read` — Read DM metadata
- `im:history` — Read DM messages
- `users:read` — Look up user info
- `users:read.email` — Get email for user display
- `commands` — Register slash commands

### Required Event Subscriptions
- `message.im` — When someone DMs the bot
- `app_mention` — When bot is @mentioned (optional)

### Interactivity
- Request URL: `https://your-app.railway.app/api/slack/events`
- Slash commands registered: `/interview`

---

## Key Design Principles

1. **Editor is always in control.** AI suggests, editor approves. Never send a question or publish content without editorial oversight (unless explicitly configured for full-auto mode).

2. **Preserve everything.** Never discard a quote. The AI selects what goes in the draft, but the editor can always access every raw exchange.

3. **Respect participants' time.** Space out questions. Don't bombard. Make it easy to skip or pause. The bot should feel like a thoughtful colleague, not an automated survey.

4. **Quote fidelity is sacred.** Every quote in a draft must be verbatim. The three-pass compilation process exists specifically to catch any AI rewording.

5. **Async-first.** Everything is designed for people responding over days, not minutes. No timeouts, no "session expired", no lost work.

6. **Single source of truth.** The database is the authority. Slack messages are delivery mechanisms. The dashboard is the viewing layer. Don't store state in Slack metadata.

---

## Connection to Existing WordPress Plugin

The existing `jb-ai-interviewer` WordPress plugin is a **single-person, synchronous** interview tool. This Slack bot is a **multi-person, asynchronous** interview tool. They share the same DNA but serve different workflows.

**Future integration path:**
1. Add a "Publish to WordPress" button in the dashboard
2. Use the WordPress REST API to create an `ai_interview` post
3. Map the compiled draft → WordPress blocks (reuse the `/format` endpoint's block structure)
4. Push participant names as custom fields
5. Trigger artwork generation via the existing Gemini integration

This keeps both tools independent but connected when needed.
