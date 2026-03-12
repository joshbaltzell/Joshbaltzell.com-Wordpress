import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ============================================================
// ENUMS
// ============================================================

export const projectStatusEnum = pgEnum("project_status", [
  "setup",
  "interviewing",
  "compiling",
  "review",
  "published",
]);

export const participantRoleEnum = pgEnum("participant_role", [
  "editor",
  "interviewee",
  "reviewer",
]);

export const participantStatusEnum = pgEnum("participant_status", [
  "pending",
  "active",
  "completed",
  "declined",
]);

export const questionOriginEnum = pgEnum("question_origin", [
  "manual",
  "ai_followup",
  "ai_crosspoll",
]);

export const questionPriorityEnum = pgEnum("question_priority", [
  "high",
  "medium",
  "low",
]);

export const exchangeStatusEnum = pgEnum("exchange_status", [
  "pending",
  "sent",
  "answered",
  "skipped",
]);

export const approvalModeEnum = pgEnum("approval_mode", [
  "auto",
  "editor_approves_all",
  "full_auto",
]);

export const followUpRelationshipEnum = pgEnum("followup_relationship", [
  "followup",
  "crosspoll",
  "clarification",
]);

export const quoteApprovalStatusEnum = pgEnum("quote_approval_status", [
  "pending",
  "approved",
  "rejected",
  "edit_suggested",
]);

// ============================================================
// PROJECTS
// ============================================================

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  thesis: text("thesis"),
  targetAudience: text("target_audience"),
  status: projectStatusEnum("status").notNull().default("setup"),
  targetWordCount: integer("target_word_count").default(1500),
  editorSlackUserId: text("editor_slack_user_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  approvalMode: approvalModeEnum("approval_mode").notNull().default("auto"),
  maxRounds: integer("max_rounds").default(10),
  nudgeAfterHours: integer("nudge_after_hours").default(48),
  deadline: timestamp("deadline", { withTimezone: true }),
  autoCompileOnDeadline: boolean("auto_compile_on_deadline").notNull().default(true),
  startedAt: timestamp("started_at", { withTimezone: true }),
  settings: jsonb("settings").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================
// PARTICIPANTS
// ============================================================

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    slackUserId: text("slack_user_id").notNull(),
    name: text("name").notNull(),
    title: text("title"),
    role: participantRoleEnum("role").notNull().default("interviewee"),
    context: text("context"),
    status: participantStatusEnum("status").notNull().default("pending"),
    dmChannelId: text("dm_channel_id"),
    lastNudgeAt: timestamp("last_nudge_at", { withTimezone: true }),
    nudgeCount: integer("nudge_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_participants_project").on(table.projectId),
    index("idx_participants_slack_user").on(table.slackUserId),
  ]
);

// ============================================================
// QUESTIONS
// ============================================================

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    origin: questionOriginEnum("origin").notNull().default("manual"),
    sourceExchangeId: uuid("source_exchange_id"),
    sourceParticipantIds: text("source_participant_ids")
      .array()
      .$type<string[]>(),
    priority: questionPriorityEnum("priority").notNull().default("medium"),
    approved: boolean("approved").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_questions_project").on(table.projectId),
    index("idx_questions_project_approved").on(table.projectId, table.approved),
  ]
);

// ============================================================
// EXCHANGES
// ============================================================

export const exchanges = pgTable(
  "exchanges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    answerText: text("answer_text"),
    sequence: integer("sequence").notNull(),
    status: exchangeStatusEnum("status").notNull().default("pending"),
    slackMessageTs: text("slack_message_ts"),
    askedAt: timestamp("asked_at", { withTimezone: true }),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_exchanges_project").on(table.projectId),
    index("idx_exchanges_participant").on(table.participantId),
    uniqueIndex("idx_exchanges_participant_seq").on(
      table.participantId,
      table.sequence
    ),
  ]
);

// ============================================================
// FOLLOW-UP THREADS
// ============================================================

export const followUpThreads = pgTable(
  "follow_up_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parentExchangeId: uuid("parent_exchange_id")
      .notNull()
      .references(() => exchanges.id),
    childExchangeId: uuid("child_exchange_id")
      .notNull()
      .references(() => exchanges.id),
    relationship: followUpRelationshipEnum("relationship")
      .notNull()
      .default("followup"),
    rationale: text("rationale"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_threads_parent").on(table.parentExchangeId),
  ]
);

// ============================================================
// DRAFTS
// ============================================================

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    bodyHtml: text("body_html"),
    thematicAnalysis: jsonb("thematic_analysis"),
    modelUsed: text("model_used"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_drafts_project").on(table.projectId)]
);

// ============================================================
// QUOTE APPROVALS
// ============================================================

export const quoteApprovals = pgTable(
  "quote_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    exchangeId: uuid("exchange_id")
      .notNull()
      .references(() => exchanges.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    quoteText: text("quote_text").notNull(),
    originalText: text("original_text").notNull(),
    isParaphrased: boolean("is_paraphrased").notNull().default(false),
    contextInArticle: text("context_in_article"),
    status: quoteApprovalStatusEnum("status").notNull().default("pending"),
    suggestedEdit: text("suggested_edit"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    slackMessageTs: text("slack_message_ts"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_quote_approvals_draft").on(table.draftId),
    index("idx_quote_approvals_participant").on(table.participantId),
    index("idx_quote_approvals_project_status").on(table.projectId, table.status),
  ]
);

// ============================================================
// DRAFT QUOTE REFS
// ============================================================

export const draftQuoteRefs = pgTable(
  "draft_quote_refs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    exchangeId: uuid("exchange_id")
      .notNull()
      .references(() => exchanges.id),
    quoteSnippet: text("quote_snippet").notNull(),
    locationHint: text("location_hint"),
    editorIncluded: boolean("editor_included").notNull().default(true),
    editorExcluded: boolean("editor_excluded").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_quote_refs_draft").on(table.draftId)]
);
