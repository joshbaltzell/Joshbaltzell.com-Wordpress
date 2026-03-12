import { relations } from "drizzle-orm";
import {
  projects,
  participants,
  questions,
  exchanges,
  followUpThreads,
  drafts,
  draftQuoteRefs,
  quoteApprovals,
} from "./schema";

export const projectsRelations = relations(projects, ({ many }) => ({
  participants: many(participants),
  questions: many(questions),
  exchanges: many(exchanges),
  drafts: many(drafts),
  quoteApprovals: many(quoteApprovals),
}));

export const participantsRelations = relations(participants, ({ one, many }) => ({
  project: one(projects, {
    fields: [participants.projectId],
    references: [projects.id],
  }),
  exchanges: many(exchanges),
  quoteApprovals: many(quoteApprovals),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  project: one(projects, {
    fields: [questions.projectId],
    references: [projects.id],
  }),
  exchanges: many(exchanges),
}));

export const exchangesRelations = relations(exchanges, ({ one }) => ({
  project: one(projects, {
    fields: [exchanges.projectId],
    references: [projects.id],
  }),
  participant: one(participants, {
    fields: [exchanges.participantId],
    references: [participants.id],
  }),
  question: one(questions, {
    fields: [exchanges.questionId],
    references: [questions.id],
  }),
}));

export const followUpThreadsRelations = relations(followUpThreads, ({ one }) => ({
  project: one(projects, {
    fields: [followUpThreads.projectId],
    references: [projects.id],
  }),
  parentExchange: one(exchanges, {
    fields: [followUpThreads.parentExchangeId],
    references: [exchanges.id],
    relationName: "parentExchange",
  }),
  childExchange: one(exchanges, {
    fields: [followUpThreads.childExchangeId],
    references: [exchanges.id],
    relationName: "childExchange",
  }),
}));

export const draftsRelations = relations(drafts, ({ one, many }) => ({
  project: one(projects, {
    fields: [drafts.projectId],
    references: [projects.id],
  }),
  quoteRefs: many(draftQuoteRefs),
  quoteApprovals: many(quoteApprovals),
}));

export const draftQuoteRefsRelations = relations(draftQuoteRefs, ({ one }) => ({
  draft: one(drafts, {
    fields: [draftQuoteRefs.draftId],
    references: [drafts.id],
  }),
  exchange: one(exchanges, {
    fields: [draftQuoteRefs.exchangeId],
    references: [exchanges.id],
  }),
}));

export const quoteApprovalsRelations = relations(quoteApprovals, ({ one }) => ({
  draft: one(drafts, {
    fields: [quoteApprovals.draftId],
    references: [drafts.id],
  }),
  exchange: one(exchanges, {
    fields: [quoteApprovals.exchangeId],
    references: [exchanges.id],
  }),
  participant: one(participants, {
    fields: [quoteApprovals.participantId],
    references: [participants.id],
  }),
  project: one(projects, {
    fields: [quoteApprovals.projectId],
    references: [projects.id],
  }),
}));
