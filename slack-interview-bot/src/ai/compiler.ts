import { getProModel, getFlashModel, parseJsonResponse } from "./client";
import {
  buildExtractionPrompt,
  buildAssemblyPrompt,
  buildAuditPrompt,
} from "./prompts";
import type {
  ThematicAnalysis,
  AuditResult,
  QuoteMismatch,
  ParaphraseFlag,
  FormattedExchange,
} from "@/lib/types";

export interface CompilationResult {
  title: string;
  body: string;
  thematicAnalysis: ThematicAnalysis;
  mismatches: QuoteMismatch[];
  paraphraseFlags: ParaphraseFlag[];
  modelUsed: string;
}

/**
 * Three-pass draft compilation:
 * 1. Thematic extraction — identify threads and cluster quotes
 * 2. Draft assembly — write a narrative article with inline quote/paraphrase markers
 * 3. Quote fidelity & paraphrase audit — verify quotes match sources, flag risky paraphrases
 */
export async function compileDraft(params: {
  title: string;
  thesis: string;
  audience: string;
  targetWordCount: number;
  allExchanges: FormattedExchange[];
}): Promise<CompilationResult> {
  const proModel = getProModel();
  const flashModel = getFlashModel();

  // PASS 1: Thematic Extraction
  const extractionPrompt = buildExtractionPrompt({
    thesis: params.thesis,
    audience: params.audience,
    allExchanges: params.allExchanges,
  });

  const extractionResult = await proModel.generateContent({
    contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });

  const analysisText = extractionResult.response.text();
  const thematicAnalysis = parseJsonResponse<ThematicAnalysis>(analysisText);

  // PASS 2: Draft Assembly (narrative article, not interview transcript)
  const assemblyPrompt = buildAssemblyPrompt({
    title: params.title,
    thesis: params.thesis,
    audience: params.audience,
    targetWordCount: params.targetWordCount,
    thematicAnalysis: analysisText,
    allExchanges: params.allExchanges,
  });

  const assemblyResult = await proModel.generateContent({
    contents: [{ role: "user", parts: [{ text: assemblyPrompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  });

  const draftBody = assemblyResult.response.text();

  // PASS 3: Quote Fidelity & Paraphrase Audit
  const auditPrompt = buildAuditPrompt({
    draft: draftBody,
    allExchanges: params.allExchanges,
  });

  const auditResult = await flashModel.generateContent({
    contents: [{ role: "user", parts: [{ text: auditPrompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });

  const audit = parseJsonResponse<AuditResult>(auditResult.response.text());

  return {
    title: params.title,
    body: draftBody,
    thematicAnalysis,
    mismatches: audit.quoteMismatches || [],
    paraphraseFlags: audit.paraphraseFlags || [],
    modelUsed: "gemini-2.0-pro",
  };
}
