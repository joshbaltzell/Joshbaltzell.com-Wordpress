import { getProModel, parseJsonResponse } from "./client";
import { buildCrossPollPrompt } from "./prompts";
import type { GeneratedCrossPoll } from "@/lib/types";

/**
 * Analyze exchanges across participants and generate cross-pollination questions.
 * Finds themes one participant raised that others haven't been asked about.
 */
export async function generateCrossPollQuestions(params: {
  thesis: string;
  allExchangesByTheme: string;
  triggerParticipantName: string;
  triggerThemes: string;
}): Promise<GeneratedCrossPoll[]> {
  const model = getProModel();
  const prompt = buildCrossPollPrompt(params);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  });

  const text = result.response.text();
  const questions = parseJsonResponse<GeneratedCrossPoll[]>(text);

  return questions
    .filter(
      (q) => q.participantId && q.question && q.theme && q.rationale
    )
    .slice(0, 2);
}
