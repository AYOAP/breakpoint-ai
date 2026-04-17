export type WorkflowPhase =
  | "define"
  | "calibrate"
  | "clarify-loading"
  | "clarify"
  | "processing"
  | "verdict"
  | "analysis";

export type IdeaStageValue =
  | "just_idea"
  | "early_concept"
  | "planned_not_built"
  | "mvp_in_progress"
  | "mvp_built"
  | "in_market";

export interface ClarificationPair {
  question: string;
  answer: string;
}

export interface ClarifyResponse {
  questions: string[];
}

export interface AnalysisBreakdown {
  venture_summary: string;
  invincibility_score: number;
  verdict: string;
  core_break_point: string;
  structural_weak_points: string[];
  failure_scenarios: string[];
  kill_conditions: string[];
  proof_required_before_launch: string[];
  hidden_assumptions: string[];
  strengthening_moves: string[];
}
