import { getFlashModel, parseJsonResponse } from "@/ai/client";
import { buildSeedQuestionsPrompt } from "@/ai/prompts";

/**
 * Generate initial interview questions tailored to a specific participant.
 * These are the first questions the bot will ask before AI follow-ups kick in.
 */
export async function generateSeedQuestions(params: {
  thesis: string;
  audience: string;
  participantName: string;
  participantTitle: string;
  participantContext: string;
  questionCount: number;
}): Promise<string[]> {
  const model = getFlashModel();
  const prompt = buildSeedQuestionsPrompt(params);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  });

  const text = result.response.text();
  const questions = parseJsonResponse<string[]>(text);

  return questions.filter((q) => typeof q === "string" && q.length > 0);
}
