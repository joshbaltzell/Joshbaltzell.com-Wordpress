import { getFlashModel, parseJsonResponse } from "./client";
import { buildFollowUpPrompt } from "./prompts";
import type { GeneratedFollowUp, FormattedExchange } from "@/lib/types";

/**
 * Generate follow-up questions based on a participant's latest answer.
 * Returns 0-3 follow-up questions ranked by priority.
 */
export async function generateFollowUps(params: {
  thesis: string;
  audience: string;
  participantName: string;
  participantTitle: string;
  participantContext: string;
  priorExchanges: FormattedExchange[];
  latestQuestion: string;
  latestAnswer: string;
}): Promise<GeneratedFollowUp[]> {
  const model = getFlashModel();
  const prompt = buildFollowUpPrompt(params);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  });

  const text = result.response.text();
  const followUps = parseJsonResponse<GeneratedFollowUp[]>(text);

  // Validate and filter
  return followUps
    .filter(
      (f) =>
        f.question &&
        f.rationale &&
        ["high", "medium", "low"].includes(f.priority)
    )
    .slice(0, 3);
}
