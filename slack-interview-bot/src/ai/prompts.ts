import type { FormattedExchange } from "@/lib/types";

// ============================================================
// FOLLOW-UP QUESTION GENERATOR
// ============================================================

export function buildFollowUpPrompt(params: {
  thesis: string;
  audience: string;
  participantName: string;
  participantTitle: string;
  participantContext: string;
  priorExchanges: FormattedExchange[];
  latestQuestion: string;
  latestAnswer: string;
}): string {
  const priorFormatted = params.priorExchanges
    .map(
      (ex) =>
        `[${ex.exchangeId}] Q: ${ex.question}\nA: "${ex.answer}"`
    )
    .join("\n\n");

  return `You are an investigative interviewer gathering material for an article.

ARTICLE THESIS: ${params.thesis}
TARGET AUDIENCE: ${params.audience}

THIS PARTICIPANT: ${params.participantName}, ${params.participantTitle}
CONTEXT: ${params.participantContext}

THEIR CONVERSATION SO FAR:
${priorFormatted}

LATEST EXCHANGE:
Q: ${params.latestQuestion}
A: "${params.latestAnswer}"

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

Return ONLY a JSON array:
[{"question": "...", "rationale": "...", "priority": "high|medium|low"}]`;
}

// ============================================================
// CROSS-POLLINATION
// ============================================================

export function buildCrossPollPrompt(params: {
  thesis: string;
  allExchangesByTheme: string;
  triggerParticipantName: string;
  triggerThemes: string;
}): string {
  return `You are analyzing interview responses across multiple participants for an article.

ARTICLE THESIS: ${params.thesis}

PARTICIPANT RESPONSES GROUPED BY THEME:
${params.allExchangesByTheme}

PARTICIPANT WHO JUST ANSWERED: ${params.triggerParticipantName}
THEMES THEY TOUCHED ON: ${params.triggerThemes}

For each theme this participant raised, identify other participants who HAVEN'T been asked about it yet.
Generate a question for each uncovered participant that explores the same theme from their perspective.

Rules:
- Do NOT reveal what other participants said (no "Sarah mentioned...")
- Frame questions around the theme, not the specific quote
- Only generate questions where the participant's context suggests they'd have relevant input
- Maximum 2 cross-pollination questions per event

Return ONLY a JSON array:
[{"participant_id": "...", "question": "...", "theme": "...", "rationale": "..."}]

Return empty array if no cross-pollination is needed.`;
}

// ============================================================
// SATURATION DETECTOR
// ============================================================

export function buildSaturationPrompt(params: {
  thesis: string;
  targetWordCount: number;
  audience: string;
  allExchanges: FormattedExchange[];
}): string {
  const formatted = params.allExchanges
    .map(
      (ex) =>
        `[${ex.exchangeId}] ${ex.participantName} (${ex.participantTitle}):\n  Q: ${ex.question}\n  A: "${ex.answer}"`
    )
    .join("\n\n");

  return `You are an editorial analyst assessing whether enough interview material has been collected to write a compelling article.

ARTICLE THESIS: ${params.thesis}
TARGET WORD COUNT: ${params.targetWordCount} words
TARGET AUDIENCE: ${params.audience}

ALL EXCHANGES COLLECTED:
${formatted}

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

Return JSON:
{
  "scores": {"thesis": N, "diversity": N, "quotes": N, "counterpoint": N, "narrative": N},
  "gaps": ["..."],
  "strongestQuotes": [{"exchangeId": "...", "snippet": "...", "reason": "..."}],
  "recommendedNext": [{"participantId": "...", "question": "...", "reason": "..."}],
  "readyToDraft": true|false,
  "reasoning": "..."
}

Set readyToDraft=true only if ALL scores >= 3 and at least three are >= 4.`;
}

// ============================================================
// DRAFT COMPILATION — PASS 1: THEMATIC EXTRACTION
// ============================================================

export function buildExtractionPrompt(params: {
  thesis: string;
  audience: string;
  allExchanges: FormattedExchange[];
}): string {
  const formatted = params.allExchanges
    .map(
      (ex) =>
        `[${ex.exchangeId}] ${ex.participantName} (${ex.participantTitle}):\n  Q: ${ex.question}\n  A: "${ex.answer}"`
    )
    .join("\n\n");

  return `Analyze these interview exchanges for an article about "${params.thesis}".
Target audience: ${params.audience}

EXCHANGES:
${formatted}

Tasks:
1. Identify 4-7 thematic threads that run through the interviews
2. For each thread, list the relevant quotes (EXACT text) with [EXCHANGE_ID] markers
3. Flag contradictions or tensions between participants
4. Suggest a narrative arc (how to order the themes for the article)

Return structured JSON:
{
  "threads": [
    {
      "theme": "...",
      "summary": "...",
      "exchangeIds": ["..."],
      "quotes": [{"exchangeId": "...", "text": "exact quote", "attribution": "Name, Title"}]
    }
  ],
  "contradictions": [{"description": "...", "exchangeIds": ["..."]}],
  "suggestedArc": ["theme1", "theme2", "..."]
}`;
}

// ============================================================
// DRAFT COMPILATION — PASS 2: ASSEMBLY
// ============================================================

export function buildAssemblyPrompt(params: {
  title: string;
  thesis: string;
  audience: string;
  targetWordCount: number;
  thematicAnalysis: string;
  allExchanges: FormattedExchange[];
}): string {
  const formatted = params.allExchanges
    .map(
      (ex) =>
        `[${ex.exchangeId}] ${ex.participantName} (${ex.participantTitle}):\n  Q: ${ex.question}\n  A: "${ex.answer}"`
    )
    .join("\n\n");

  return `Write a ${params.targetWordCount}-word article using the thematic analysis and raw exchanges below.

ARTICLE TITLE: ${params.title}
THESIS: ${params.thesis}
AUDIENCE: ${params.audience}

THEMATIC ANALYSIS:
${params.thematicAnalysis}

RAW EXCHANGES (for exact quote wording):
${formatted}

Rules:
- Every quote must be EXACTLY as it appears in the raw exchanges — no paraphrasing inside quotation marks
- Mark every quote with [QUOTE_ID:{exchange_id}] immediately after the closing quotation mark
- Attribute quotes to participants by name and title
- Where participants disagree, present both perspectives
- Insert [EDITOR_CHOICE: option A | option B] where two similar quotes could work and the editor should pick
- Insert [EDITOR_NOTE: ...] where you need editorial judgment
- Write in a professional but accessible tone
- Include an introduction that sets up the thesis and a conclusion that synthesizes insights

Write the article now.`;
}

// ============================================================
// DRAFT COMPILATION — PASS 3: QUOTE FIDELITY AUDIT
// ============================================================

export function buildAuditPrompt(params: {
  draft: string;
  allExchanges: FormattedExchange[];
}): string {
  const formatted = params.allExchanges
    .map(
      (ex) =>
        `[${ex.exchangeId}] ${ex.participantName}: "${ex.answer}"`
    )
    .join("\n\n");

  return `Compare every quoted string in the draft below against the raw exchanges.
Flag ANY quote that differs from its source by even one word.

DRAFT:
${params.draft}

RAW EXCHANGES:
${formatted}

Return ONLY a JSON array of mismatches:
[{"quoteInDraft": "...", "sourceText": "...", "exchangeId": "...", "issue": "..."}]

Return an empty array [] if all quotes match exactly.`;
}

// ============================================================
// INITIAL QUESTION GENERATOR
// ============================================================

export function buildSeedQuestionsPrompt(params: {
  thesis: string;
  audience: string;
  participantName: string;
  participantTitle: string;
  participantContext: string;
  questionCount: number;
}): string {
  return `You are preparing interview questions for an article.

ARTICLE THESIS: ${params.thesis}
TARGET AUDIENCE: ${params.audience}

PARTICIPANT: ${params.participantName}, ${params.participantTitle}
WHY THEY'RE INCLUDED: ${params.participantContext}

Generate ${params.questionCount} interview questions tailored to this specific participant.

Rules:
- Start with an approachable opening question that relates to their expertise
- Mix question types: open-ended explorers, specific examples, gentle challenges, forward-looking
- Each question should advance the article's thesis
- Questions should be conversational, not formal
- Order them in a natural interview progression

Return ONLY a JSON array of strings:
["Question 1?", "Question 2?", ...]`;
}
