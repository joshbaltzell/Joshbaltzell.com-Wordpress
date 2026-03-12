import { GoogleGenerativeAI } from "@google/generative-ai";

let _genAI: GoogleGenerativeAI | null = null;

export function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

/** Fast model for follow-ups, saturation checks, and audits */
export function getFlashModel() {
  return getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });
}

/** Pro model for cross-pollination and draft compilation */
export function getProModel() {
  return getGenAI().getGenerativeModel({ model: "gemini-2.0-pro" });
}

/** Parse JSON from Gemini response, stripping markdown code fences if present */
export function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
