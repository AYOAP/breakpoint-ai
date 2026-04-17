import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type { AnalysisBreakdown, ClarificationPair } from "@/types/breakpoint";

export interface AdvisoryFlag {
  kind: "legal" | "financial";
  label: string;
  description: string;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function dedupeStrings(items: string[], limit?: number) {
  const seen = new Set<string>();
  const clean: string[] = [];

  for (const item of items) {
    const normalized = item.replace(/\s+/g, " ").trim();
    if (!normalized) continue;

    const fingerprint = normalized.toLowerCase();
    if (seen.has(fingerprint)) continue;

    seen.add(fingerprint);
    clean.push(normalized);

    if (limit && clean.length >= limit) break;
  }

  return clean;
}

export function sanitizeClarificationQuestion(question: string) {
  const cleaned = question
    .normalize("NFKC")
    .replace(/[^\u0000-\u024F\u2010-\u203A]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([?!.,;:])/g, "$1")
    .replace(/^[-–—\s]+|[-–—\s]+$/g, "")
    .trim();

  if (!cleaned) {
    return "";
  }

  return /[?.!]$/.test(cleaned) ? cleaned : `${cleaned}?`;
}

function stabilizeNarrativeText(text: string) {
  let cleaned = text
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/\s+([?!.,;:])/g, "$1")
    .trim();

  if (!cleaned) {
    return "";
  }

  cleaned = cleaned.replace(/\s*[\(\[\{][^\)\]\}]*$/, "").trim();
  cleaned = cleaned.replace(/\s+\b(?:and|or|to|for|with|without|because|if|when|while|than|versus|vs)\b$/i, "").trim();
  cleaned = cleaned.replace(/\s+[A-Z]$/, "").trim();

  if (!/[.?!]["')\]]*$/.test(cleaned) && cleaned.length > 140) {
    const cutPoints = [" — ", "; ", ": ", ", "]
      .map((token) => cleaned.lastIndexOf(token))
      .filter((index) => index > cleaned.length - 70);

    if (cutPoints.length) {
      cleaned = cleaned.slice(0, Math.max(...cutPoints)).trim();
    }
  }

  cleaned = cleaned.replace(/\s+\b(?:and|or|to|for|with|without|because|if|when|while|than|versus|vs)\b$/i, "").trim();

  if (!cleaned) {
    return "";
  }

  return /[.?!]["')\]]*$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

export function normalizeBreakdown(breakdown: AnalysisBreakdown): AnalysisBreakdown {
  return {
    venture_summary: stabilizeNarrativeText(breakdown.venture_summary),
    invincibility_score: Math.min(100, Math.max(0, Math.round(breakdown.invincibility_score))),
    verdict: breakdown.verdict.replace(/\s+/g, " ").trim(),
    core_break_point: stabilizeNarrativeText(breakdown.core_break_point),
    structural_weak_points: dedupeStrings(breakdown.structural_weak_points.map(stabilizeNarrativeText), 5),
    failure_scenarios: dedupeStrings(breakdown.failure_scenarios.map(stabilizeNarrativeText), 5),
    kill_conditions: dedupeStrings(breakdown.kill_conditions.map(stabilizeNarrativeText), 5),
    proof_required_before_launch: dedupeStrings(breakdown.proof_required_before_launch.map(stabilizeNarrativeText), 5),
    hidden_assumptions: dedupeStrings(breakdown.hidden_assumptions.map(stabilizeNarrativeText), 5),
    strengthening_moves: dedupeStrings(breakdown.strengthening_moves.map(stabilizeNarrativeText), 5),
  };
}

export function detectAdvisoryFlags(content: string): AdvisoryFlag[] {
  const normalized = content.toLowerCase();
  const flags: AdvisoryFlag[] = [];

  const legalPattern =
    /\b(legal|law|lawyer|attorney|lawsuit|liability|compliance|regulation|regulatory|contract|terms of service|privacy policy|securities law|licensing|gdpr|hipaa|employment law|incorporation|llc|c-corp)\b/;
  const financialPattern =
    /\b(financial advice|investment|investor|investing|fundraise|fundraising|valuation|equity|debt|cash flow|cashflow|tax|bookkeeping|financial model|financial projection|capital structure|cap table|return on investment|roi)\b/;

  if (legalPattern.test(normalized)) {
    flags.push({
      kind: "legal",
      label: "Legal caution",
      description:
        "This system can stress test the venture logic around contracts, compliance, and structure, but it is not legal advice. Use qualified counsel for legal decisions.",
    });
  }

  if (financialPattern.test(normalized)) {
    flags.push({
      kind: "financial",
      label: "Financial caution",
      description:
        "This system can pressure test assumptions around monetization, capital, and unit economics, but it is not financial advice. Use licensed professionals for financial decisions.",
    });
  }

  return flags;
}

export function formatBreakdownForCopy(
  idea: string,
  answers: ClarificationPair[],
  breakdown: AnalysisBreakdown,
) {
  return [
    "BREAKPOINT AI",
    "Venture Evaluation Memo",
    "",
    "Idea Under Test",
    idea.trim(),
    "",
    "Clarified Assumptions",
    ...answers.map((entry, index) => `${index + 1}. ${entry.question}\n   ${entry.answer}`),
    "",
    "Venture Summary",
    breakdown.venture_summary,
    "",
    `Invincibility Score: ${breakdown.invincibility_score}/100`,
    "",
    `Verdict: ${breakdown.verdict}`,
    "",
    "Core Break Point",
    breakdown.core_break_point,
    "",
    "Structural Weaknesses",
    ...breakdown.structural_weak_points.map((item) => `- ${item}`),
    "",
    "Failure Scenarios",
    ...breakdown.failure_scenarios.map((item) => `- ${item}`),
    "",
    "Kill Conditions",
    ...breakdown.kill_conditions.map((item) => `- ${item}`),
    "",
    "Proof Required Before Launch",
    ...breakdown.proof_required_before_launch.map((item) => `- ${item}`),
    "",
    "Strengthening Moves",
    ...breakdown.strengthening_moves.map((item) => `- ${item}`),
    "",
    "Hidden Assumptions",
    ...breakdown.hidden_assumptions.map((item) => `- ${item}`),
  ].join("\n");
}
