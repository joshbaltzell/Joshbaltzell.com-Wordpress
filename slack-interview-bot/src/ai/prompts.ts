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
// DRAFT COMPILATION — PASS 2: ASSEMBLY (NARRATIVE ARTICLE)
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

  return `You are a skilled feature writer composing a ${params.targetWordCount}-word article. Write a proper narrative article — NOT an interview transcript.

ARTICLE TITLE: ${params.title}
THESIS: ${params.thesis}
AUDIENCE: ${params.audience}

THEMATIC ANALYSIS:
${params.thematicAnalysis}

RAW EXCHANGES (source material — you don't need to use everything):
${formatted}

ARTICLE STRUCTURE:
- Write a compelling narrative that weaves together the best insights from your sources
- Open with a scene-setting introduction that draws the reader in and establishes the thesis
- Organize by theme, not by person — each section should explore an idea, not list what one person said
- Close with a synthesis that ties themes together and looks forward
- Use connective tissue between quotes: context, analysis, transitions
- You are the writer — interpret, connect, and frame the material. Don't just string quotes together.

QUOTING RULES:
- Be SELECTIVE — use the strongest 40-60% of available quotes. Quality over quantity.
- Direct quotes inside quotation marks must be EXACTLY as they appear in the raw exchanges, word-for-word
- Mark every direct quote with [QUOTE_ID:{exchange_id}] immediately after the closing quotation mark
- You may paraphrase when a source's point is important but their exact words aren't particularly compelling
- When paraphrasing, mark with [PARAPHRASE_ID:{exchange_id}] at the end of the paraphrased passage
- Attribute quotes to participants by name and title on first mention, name only after
- Where sources disagree, present both perspectives with context — don't just list contradictions

EDITORIAL MARKERS:
- [EDITOR_CHOICE: option A | option B] where two quotes could work and the editor should pick
- [EDITOR_NOTE: ...] where editorial judgment is needed (e.g., sensitive claims, missing context)

TONE: Professional but accessible, authoritative but warm. Match the audience: ${params.audience}.

Write the article now.`;
}

// ============================================================
// DRAFT COMPILATION — PASS 3: QUOTE FIDELITY & PARAPHRASE AUDIT
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

  return `You are a fact-checker auditing a draft article for quote accuracy and paraphrase fidelity.

DRAFT:
${params.draft}

RAW EXCHANGES:
${formatted}

Perform TWO checks:

1. DIRECT QUOTE FIDELITY: For every string in quotation marks followed by [QUOTE_ID:xxx], verify it matches the raw source EXACTLY. Flag any difference, no matter how small.

2. PARAPHRASE CONTEXT CHECK: For every passage marked with [PARAPHRASE_ID:xxx], assess whether the paraphrase:
   - Preserves the original meaning and intent
   - Could be seen as changing what the person actually said
   - Rate each: "faithful" (meaning preserved), "minor_shift" (slightly different emphasis), or "context_changed" (materially different meaning — requires source approval)

Return JSON:
{
  "quoteMismatches": [
    {"quoteInDraft": "...", "sourceText": "...", "exchangeId": "...", "issue": "..."}
  ],
  "paraphraseFlags": [
    {"paraphraseInDraft": "...", "sourceText": "...", "exchangeId": "...", "rating": "faithful|minor_shift|context_changed", "concern": "..."}
  ]
}

Return empty arrays if everything checks out.`;
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
