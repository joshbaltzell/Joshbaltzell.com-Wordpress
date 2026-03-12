-- Slack Interview Bot — Initial Schema Migration
-- Run this against a fresh PostgreSQL database

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE project_status AS ENUM ('setup', 'interviewing', 'compiling', 'review', 'published');
CREATE TYPE participant_role AS ENUM ('editor', 'interviewee', 'reviewer');
CREATE TYPE participant_status AS ENUM ('pending', 'active', 'completed', 'declined');
CREATE TYPE question_origin AS ENUM ('manual', 'ai_followup', 'ai_crosspoll');
CREATE TYPE question_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE exchange_status AS ENUM ('pending', 'sent', 'answered', 'skipped');
CREATE TYPE approval_mode AS ENUM ('auto', 'editor_approves_all', 'full_auto');
CREATE TYPE followup_relationship AS ENUM ('followup', 'crosspoll', 'clarification');

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE projects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               TEXT NOT NULL,
    thesis              TEXT,
    target_audience     TEXT,
    status              project_status NOT NULL DEFAULT 'setup',
    target_word_count   INT DEFAULT 1500,
    editor_slack_user_id TEXT NOT NULL,
    workspace_id        TEXT NOT NULL,
    approval_mode       approval_mode NOT NULL DEFAULT 'auto',
    max_rounds          INT DEFAULT 10,
    nudge_after_hours   INT DEFAULT 48,
    settings            JSONB,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PARTICIPANTS
-- ============================================================

CREATE TABLE participants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    slack_user_id   TEXT NOT NULL,
    name            TEXT NOT NULL,
    title           TEXT,
    role            participant_role NOT NULL DEFAULT 'interviewee',
    context         TEXT,
    status          participant_status NOT NULL DEFAULT 'pending',
    dm_channel_id   TEXT,
    last_nudge_at   TIMESTAMPTZ,
    nudge_count     INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_participants_project ON participants(project_id);
CREATE INDEX idx_participants_slack_user ON participants(slack_user_id);

-- ============================================================
-- QUESTIONS
-- ============================================================

CREATE TABLE questions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    text                    TEXT NOT NULL,
    origin                  question_origin NOT NULL DEFAULT 'manual',
    source_exchange_id      UUID,
    source_participant_ids  UUID[],
    priority                question_priority NOT NULL DEFAULT 'medium',
    approved                BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_questions_project ON questions(project_id);

-- ============================================================
-- EXCHANGES
-- ============================================================

CREATE TABLE exchanges (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    participant_id      UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    question_id         UUID NOT NULL REFERENCES questions(id),
    answer_text         TEXT,
    sequence            INT NOT NULL,
    status              exchange_status NOT NULL DEFAULT 'pending',
    slack_message_ts    TEXT,
    asked_at            TIMESTAMPTZ,
    answered_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exchanges_project ON exchanges(project_id);
CREATE INDEX idx_exchanges_participant ON exchanges(participant_id);
CREATE UNIQUE INDEX idx_exchanges_participant_seq ON exchanges(participant_id, sequence);

-- ============================================================
-- FOLLOW-UP THREADS
-- ============================================================

CREATE TABLE follow_up_threads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_exchange_id  UUID NOT NULL REFERENCES exchanges(id),
    child_exchange_id   UUID NOT NULL REFERENCES exchanges(id),
    relationship        followup_relationship NOT NULL DEFAULT 'followup',
    rationale           TEXT,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_threads_parent ON follow_up_threads(parent_exchange_id);

-- ============================================================
-- DRAFTS
-- ============================================================

CREATE TABLE drafts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version             INT NOT NULL,
    title               TEXT,
    body                TEXT NOT NULL,
    body_html           TEXT,
    thematic_analysis   JSONB,
    model_used          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_drafts_project ON drafts(project_id);

-- ============================================================
-- DRAFT QUOTE REFS
-- ============================================================

CREATE TABLE draft_quote_refs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id            UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    exchange_id         UUID NOT NULL REFERENCES exchanges(id),
    quote_snippet       TEXT NOT NULL,
    location_hint       TEXT,
    editor_included     BOOLEAN NOT NULL DEFAULT true,
    editor_excluded     BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quote_refs_draft ON draft_quote_refs(draft_id);

-- Foreign key for questions referencing exchanges (added after exchanges table exists)
ALTER TABLE questions
    ADD CONSTRAINT fk_questions_source_exchange
    FOREIGN KEY (source_exchange_id) REFERENCES exchanges(id);
