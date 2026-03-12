-- Migration 0002: Add quote approvals, deadlines, and auto-compile support
-- Run after 0001_initial.sql

-- ============================================================
-- New enum for quote approval status
-- ============================================================

CREATE TYPE quote_approval_status AS ENUM ('pending', 'approved', 'rejected', 'edit_suggested');

-- ============================================================
-- Add deadline/auto-compile columns to projects
-- ============================================================

ALTER TABLE projects
    ADD COLUMN deadline TIMESTAMPTZ,
    ADD COLUMN auto_compile_on_deadline BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN started_at TIMESTAMPTZ;

-- ============================================================
-- QUOTE APPROVALS
-- ============================================================

CREATE TABLE quote_approvals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id            UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    exchange_id         UUID NOT NULL REFERENCES exchanges(id),
    participant_id      UUID NOT NULL REFERENCES participants(id),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    quote_text          TEXT NOT NULL,
    original_text       TEXT NOT NULL,
    is_paraphrased      BOOLEAN NOT NULL DEFAULT false,
    context_in_article  TEXT,
    status              quote_approval_status NOT NULL DEFAULT 'pending',
    suggested_edit      TEXT,
    reviewed_at         TIMESTAMPTZ,
    slack_message_ts    TEXT,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quote_approvals_draft ON quote_approvals(draft_id);
CREATE INDEX idx_quote_approvals_participant ON quote_approvals(participant_id);
CREATE INDEX idx_quote_approvals_project_status ON quote_approvals(project_id, status);
