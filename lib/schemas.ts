import { z } from "zod";

const stageSchema = z.enum([
  "just_idea",
  "early_concept",
  "planned_not_built",
  "mvp_in_progress",
  "mvp_built",
  "in_market",
]);

export const clarifyRequestSchema = z.object({
  idea: z
    .string()
    .trim()
    .min(20, "Enter a fuller idea before running the stress test.")
    .max(6000, "The idea is too long. Tighten it before submitting."),
  stage: stageSchema,
  stage_note: z
    .string()
    .trim()
    .max(240, "Keep the stage note short and direct.")
    .optional()
    .default(""),
});

export const analyzeRequestSchema = z.object({
  idea: z
    .string()
    .trim()
    .min(20, "Enter a fuller idea before running the stress test.")
    .max(6000, "The idea is too long. Tighten it before submitting."),
  answers: z
    .array(
      z.object({
        question: z.string().trim().min(1),
        answer: z.string().trim().min(3, "Every clarification needs an answer."),
      }),
    )
    .min(2, "Answer the clarification questions before applying pressure.")
    .max(5),
});

export const clarifyResultSchema = z.object({
  questions: z
    .array(z.string().trim().min(8).max(340))
    .min(2)
    .max(5),
});

const analysisListSchema = z
  .array(z.string().trim().min(6).max(220))
  .min(2)
  .max(5);

export const analysisResultSchema = z.object({
  venture_summary: z.string().trim().min(24).max(260),
  invincibility_score: z.number().int().min(0).max(100),
  verdict: z.string().trim().min(8).max(80),
  core_break_point: z.string().trim().min(12).max(180),
  structural_weak_points: analysisListSchema,
  failure_scenarios: analysisListSchema,
  kill_conditions: analysisListSchema,
  proof_required_before_launch: analysisListSchema,
  hidden_assumptions: analysisListSchema,
  strengthening_moves: analysisListSchema,
});

export type ClarifyRequest = z.infer<typeof clarifyRequestSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
