/** Saturation scores returned by the AI saturation detector */
export interface SaturationScores {
  thesis: number;
  diversity: number;
  quotes: number;
  counterpoint: number;
  narrative: number;
}

export interface SaturationReport {
  scores: SaturationScores;
  gaps: string[];
  strongestQuotes: Array<{
    exchangeId: string;
    snippet: string;
    reason: string;
  }>;
  recommendedNext: Array<{
    participantId: string;
    question: string;
    reason: string;
  }>;
  readyToDraft: boolean;
  reasoning: string;
}

/** AI-generated follow-up question */
export interface GeneratedFollowUp {
  question: string;
  rationale: string;
  priority: "high" | "medium" | "low";
}

/** AI-generated cross-pollination question */
export interface GeneratedCrossPoll {
  participantId: string;
  question: string;
  theme: string;
  rationale: string;
}

/** Thematic analysis from draft compilation pass 1 */
export interface ThematicThread {
  theme: string;
  summary: string;
  exchangeIds: string[];
  quotes: Array<{
    exchangeId: string;
    text: string;
    attribution: string;
  }>;
}

export interface ThematicAnalysis {
  threads: ThematicThread[];
  contradictions: Array<{
    description: string;
    exchangeIds: string[];
  }>;
  suggestedArc: string[];
}

/** Quote fidelity audit result */
export interface QuoteMismatch {
  quoteInDraft: string;
  sourceText: string;
  exchangeId: string;
  issue: string;
}

/** Paraphrase fidelity flag from audit */
export interface ParaphraseFlag {
  paraphraseInDraft: string;
  sourceText: string;
  exchangeId: string;
  rating: "faithful" | "minor_shift" | "context_changed";
  concern: string;
}

/** Combined audit result from pass 3 */
export interface AuditResult {
  quoteMismatches: QuoteMismatch[];
  paraphraseFlags: ParaphraseFlag[];
}

/** Formatted exchange for AI prompts */
export interface FormattedExchange {
  exchangeId: string;
  participantName: string;
  participantTitle: string;
  question: string;
  answer: string;
  sequence: number;
  answeredAt: string;
}
