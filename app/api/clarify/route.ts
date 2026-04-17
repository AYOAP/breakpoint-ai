import { NextResponse } from "next/server";
import { zodTextFormat } from "openai/helpers/zod";

import { consumeDailyQuota } from "@/lib/daily-quota";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import { buildClarifyUserPrompt, clarifySystemPrompt } from "@/lib/prompts";
import { clarifyRequestSchema, clarifyResultSchema } from "@/lib/schemas";
import { dedupeStrings, sanitizeClarificationQuestion } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = clarifyRequestSchema.safeParse(body);

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
    let questions: string[] = [];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const retryInstruction =
        attempt === 0
          ? ""
          : "\n\nThe previous output was invalid. Return clean plain-English questions only, with no garbled characters and no cut-off endings.";

      const response = await client.responses.parse({
        model: getOpenAIModel(),
        input: [
          { role: "system", content: clarifySystemPrompt },
          {
            role: "user",
            content: `${buildClarifyUserPrompt(parsed.data.idea, parsed.data.stage, parsed.data.stage_note)}${retryInstruction}`,
          },
        ],
        text: {
          format: zodTextFormat(clarifyResultSchema, "clarification_questions"),
        },
      });

      const output = response.output_parsed;

      if (!output) {
        if (attempt === 0) {
          continue;
        }

        throw new Error("The model did not return structured clarification questions.");
      }

      questions = dedupeStrings(output.questions.map(sanitizeClarificationQuestion), 5);

      if (questions.length >= 2) {
        break;
      }

      if (attempt === 1) {
        throw new Error("The system did not generate enough useful clarification questions. Try again.");
      }
    }

    return NextResponse.json(
      { questions },
      {
        headers: {
          "X-Breakpoint-Limit": String(quota.limit),
          "X-Breakpoint-Remaining": String(quota.remaining),
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate clarification questions right now.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
