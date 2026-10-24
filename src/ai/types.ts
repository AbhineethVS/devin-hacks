import type { TraceSummary } from "../engine/types";

// Request/response shapes for the api/ functions (CONTRACTS.md §10).
export interface GenerateRequest {
  prompt: string;
  lang: "js";
  previousError?: string;
  previousCode?: string;
}
export interface GenerateResponse {
  code: string;
  title: string;
  notes: string;
}
export interface ExplainRequest {
  code: string;
  traceSummary: TraceSummary;
  question?: string;
}
export interface ExplainResponse {
  explanation: string;
  lines: number[];
}
