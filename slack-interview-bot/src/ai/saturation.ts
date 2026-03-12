import { getFlashModel, parseJsonResponse } from "./client";
import { buildSaturationPrompt } from "./prompts";
import type { SaturationReport, FormattedExchange } from "@/lib/types";

/**
 * Assess whether enough interview material has been collected to draft an article.
 * Returns scores across 5 dimensions and a readyToDraft boolean.
 */
export async function checkSaturation(params: {
  thesis: string;
  targetWordCount: number;
  audience: string;
  allExchanges: FormattedExchange[];
}): Promise<SaturationReport> {
  const model = getFlashModel();
  const prompt = buildSaturationPrompt(params);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  const text = result.response.text();
  return parseJsonResponse<SaturationReport>(text);
}
