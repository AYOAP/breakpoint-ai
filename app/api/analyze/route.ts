import { NextResponse } from "next/server";
import { zodTextFormat } from "openai/helpers/zod";

import { consumeDailyQuota } from "@/lib/daily-quota";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import { buildAnalysisUserPrompt, analysisSystemPrompt } from "@/lib/prompts";
import { analysisResultSchema, analyzeRequestSchema } from "@/lib/schemas";
import { normalizeBreakdown } from "@/lib/utils";

export const runtime = "nodejs";

function hasBalancedDelimiters(text: string) {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const opening = new Set(Object.values(pairs));
  const stack: string[] = [];

  for (const character of text) {
    if (opening.has(character)) {
      stack.push(character);
      continue;
    }

    const expected = pairs[character];

    if (expected) {
      if (stack.pop() !== expected) {
        return false;
      }
    }
  }

  return stack.length === 0;
}

function hasReadableEnding(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return false;
  }

  return /[.?!]["')\]]*$/.test(cleaned) && hasBalancedDelimiters(cleaned);
}

function hasUsableBreakdownShape(breakdown: Awaited<ReturnType<typeof normalizeBreakdown>>) {
  const sections = [
    breakdown.structural_weak_points,
    breakdown.failure_scenarios,
    breakdown.kill_conditions,
    breakdown.proof_required_before_launch,
    breakdown.hidden_assumptions,
    breakdown.strengthening_moves,
  ];
  const narrativeBlocks = [breakdown.venture_summary, breakdown.core_break_point, ...sections.flat()];

  return (
    Boolean(breakdown.venture_summary) &&
    Boolean(breakdown.verdict) &&
    Boolean(breakdown.core_break_point) &&
    sections.every((items) => items.length >= 2) &&
    narrativeBlocks.every(hasReadableEnding)
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = analyzeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request." },
        { status: 400 },
      );
    }

    const quota = consumeDailyQuota();

    if (!quota.allowed) {
      return NextResponse.json(
        {
          error:
            "BreakPoint AI is at its daily testing limit for today. Try again tomorrow or raise BREAKPOINT_DAILY_API_LIMIT before redeploying.",
        },
        {
          status: 429,
          headers: {
            "X-Breakpoint-Limit": String(quota.limit),
            "X-Breakpoint-Remaining": String(quota.remaining),
          },
        },
      );
    }

    const client = getOpenAIClient();
    let normalized = null;
    let lastDraft = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const retryInstruction =
        attempt === 0
          ? ""
          : "\n\nValidation failed previously. Return 2 to 5 complete, specific bullets in every list. Do not use one-word fragments or partial items.";

      const response = await client.responses.parse({
        model: getOpenAIModel(),
        input: [
          { role: "system", content: analysisSystemPrompt },
          {
            role: "user",
            content: `${buildAnalysisUserPrompt(parsed.data.idea, parsed.data.answers)}${retryInstruction}`,
          },
        ],
        text: {
          format: zodTextFormat(analysisResultSchema, "breakdown_analysis"),
        },
      });

      const output = response.output_parsed;

      if (!output) {
        if (attempt === 0) {
          continue;
        }

        throw new Error("The model did not return a structured breakdown.");
      }

      const nextBreakdown = normalizeBreakdown(output);
      lastDraft = nextBreakdown;

      if (hasUsableBreakdownShape(nextBreakdown)) {
        normalized = nextBreakdown;
        break;
      }

      if (attempt === 1) {
        throw new Error("The system returned an incomplete breakdown. Run the analysis again.");
      }
    }

    if (!normalized && lastDraft) {
      const repairResponse = await client.responses.parse({
        model: getOpenAIModel(),
        input: [
          {
            role: "system",
            content:
              "You repair BREAKPOINT AI venture evaluation JSON. Preserve the structure, meaning, and section count. Rewrite clipped or dangling endings into clean complete thoughts. Every field except verdict must end with terminal punctuation.",
          },
          {
            role: "user",
            content: `Repair this breakdown so it reads cleanly and remains specific:\n${JSON.stringify(lastDraft)}`,
          },
        ],
        text: {
          format: zodTextFormat(analysisResultSchema, "breakdown_analysis_repair"),
        },
      });

      const repaired = repairResponse.output_parsed ? normalizeBreakdown(repairResponse.output_parsed) : null;

      if (repaired && hasUsableBreakdownShape(repaired)) {
        normalized = repaired;
      }
    }

    if (!normalized) {
      throw new Error("The system returned an incomplete breakdown. Run the analysis again.");
    }

    return NextResponse.json(
      normalized,
      {
        headers: {
          "X-Breakpoint-Limit": String(quota.limit),
          "X-Breakpoint-Remaining": String(quota.remaining),
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete the breakdown right now.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
