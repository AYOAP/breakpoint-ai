"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Copy,
  Crosshair,
  Flame,
  Mic,
  MicOff,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Siren,
  TriangleAlert,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";

import { AnalysisCard } from "@/components/analysis-card";
import { CursorTrail } from "@/components/cursor-trail";
import { InfoHint } from "@/components/info-hint";
import { StepProgress } from "@/components/step-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn, detectAdvisoryFlags, formatBreakdownForCopy, type AdvisoryFlag } from "@/lib/utils";
import type {
  AnalysisBreakdown,
  AnalyzeRequestPayload,
  ClarificationPair,
  ClarifyResponse,
  IdeaStageValue,
  WorkflowPhase,
} from "@/types/breakpoint";

const sampleIdeas = [
  {
    label: "Vertical AI venture",
    idea: "Launch a subscription AI operations copilot for independent HVAC businesses that automates quoting, dispatch follow-up, and service upsells while charging a premium monthly fee.",
  },
  {
    label: "Marketplace thesis",
    idea: "Build a managed B2B marketplace that matches specialty manufacturers with ecommerce brands needing short-run packaging, taking a margin on every production order.",
  },
  {
    label: "Investor memo",
    idea: "Evaluate a startup thesis that an embedded payroll and benefits layer for construction subcontractors can become the default financial operating system for crews with inconsistent labor demand.",
  },
];

const founderFocusAreas = ["Demand", "Model", "Distribution", "Proof", "Execution"];

const ideaStages: Array<{
  value: IdeaStageValue;
  label: string;
  hint: string;
}> = [
  {
    value: "just_idea",
    label: "Just an idea",
    hint: "You have the raw concept, but the shape of the venture is still loose.",
  },
  {
    value: "early_concept",
    label: "Early concept with some thinking",
    hint: "You have a direction, but the audience, offer, or mechanism still needs sharpening.",
  },
  {
    value: "planned_not_built",
    label: "Planned out but not built",
    hint: "You know roughly how it should work, but have not turned it into a live product.",
  },
  {
    value: "mvp_in_progress",
    label: "MVP in progress",
    hint: "You are building, testing, or preparing something real for first users.",
  },
  {
    value: "mvp_built",
    label: "MVP already built",
    hint: "There is a real product or prototype, even if traction is still limited.",
  },
  {
    value: "in_market",
    label: "Already launched / in market",
    hint: "The venture has real exposure to users, revenue, or operational feedback.",
  },
];

const clarifyLoadingMessages = [
  "Mapping pressure points...",
  "Identifying what this venture depends on...",
  "Preparing targeted questions...",
];

const processingMessages = [
  "Tracing where customer truth, channels, and pricing can fail",
  "Testing whether this venture deserves real commitment",
  "Preparing the evaluation memo...",
];

const crumblePolygons = [
  "polygon(0 0, 34% 0, 30% 38%, 0 42%)",
  "polygon(34% 0, 68% 0, 63% 42%, 30% 38%)",
  "polygon(68% 0, 100% 0, 100% 36%, 63% 42%)",
  "polygon(0 42%, 30% 38%, 34% 100%, 0 100%)",
  "polygon(30% 38%, 63% 42%, 67% 100%, 34% 100%)",
  "polygon(63% 42%, 100% 36%, 100% 100%, 67% 100%)",
];

type BreakdownListKey =
  | "structural_weak_points"
  | "failure_scenarios"
  | "kill_conditions"
  | "proof_required_before_launch"
  | "hidden_assumptions"
  | "strengthening_moves";

type LeavingQuestion = {
  answer: string;
  index: number;
  question: string;
  total: number;
};

type PendingAnalysisState = {
  answers: ClarificationPair[];
  lastAnswer: string;
};

type VoiceTarget = "idea" | "stage_note" | "clarify";

type OnboardingStep = {
  body: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
};

const analysisSections: Array<{
  key: BreakdownListKey;
  title: string;
  icon: LucideIcon;
  summary?: string;
  tone: "danger" | "warning" | "pressure" | "success";
}> = [
  { key: "structural_weak_points", title: "Structural Weaknesses", icon: TriangleAlert, tone: "danger" },
  { key: "failure_scenarios", title: "Failure Scenarios", icon: Flame, tone: "warning" },
  { key: "kill_conditions", title: "Kill Conditions", icon: Siren, tone: "pressure" },
  {
    key: "proof_required_before_launch",
    title: "Proof Required Before Launch",
    icon: Activity,
    tone: "warning",
    summary: "This venture needs proof of customer pull, repeat usage, and a repeatable channel before real commitment.",
  },
  { key: "hidden_assumptions", title: "Hidden Assumptions", icon: Crosshair, tone: "pressure" },
  { key: "strengthening_moves", title: "Strengthening Moves", icon: ShieldCheck, tone: "success" },
];

const onboardingSteps: OnboardingStep[] = [
  {
    eyebrow: "Step 1",
    icon: Crosshair,
    title: "Enter the venture, not the pitch",
    body:
      "Drop in the business idea, startup plan, operating bet, or investment thesis. The clearer the buyer, offer, and edge, the sharper the pressure test gets.",
  },
  {
    eyebrow: "Step 2",
    icon: Activity,
    title: "Answer the pressure questions",
    body:
      "BreakPoint asks a few targeted questions one at a time. Those answers sharpen the weak assumptions instead of forcing the system to guess what you meant.",
  },
  {
    eyebrow: "Step 3",
    icon: ShieldCheck,
    title: "Read the verdict, then the memo",
    body:
      "You get an Invincibility Score, the core break point, and the full breakdown so you can see what deserves more commitment and what still needs proof.",
  },
];

const stageTransition = { duration: 0.28, ease: "easeOut" } as const;

async function readApiPayload<T extends { error?: string }>(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = (await response.text()).trim();

  if (!text) {
    throw new Error(fallbackMessage);
  }

  if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
    throw new Error("The app returned a page instead of API data. Refresh and run the pressure test again.");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

function getApiUrl(path: string) {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

async function postApiJson<T extends { error?: string }>(
  path: string,
  body: object,
  fallbackMessage: string,
) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(getApiUrl(path), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify(body),
      });

      const payload = await readApiPayload<T>(response, fallbackMessage);

      if (!response.ok) {
        const error = new Error(payload.error || fallbackMessage);

        if (response.status >= 500 && attempt === 0) {
          lastError = error;
          await new Promise((resolve) => window.setTimeout(resolve, 280));
          continue;
        }

        throw error;
      }

      return payload;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);
      lastError = normalizedError;
      const retryable =
        attempt === 0 &&
        (normalizedError.message.includes("returned a page instead of API data") ||
          normalizedError.message.includes("Failed to fetch") ||
          normalizedError.message.includes("NetworkError"));

      if (!retryable) {
        throw normalizedError;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 280));
    }
  }

  throw lastError ?? new Error(fallbackMessage);
}

function getStageBucket(stage: IdeaStageValue | null) {
  if (stage === "just_idea" || stage === "early_concept") {
    return "early";
  }

  if (stage === "planned_not_built" || stage === "mvp_in_progress") {
    return "mid";
  }

  return "late";
}

function getScoreTone(score: number, stage: IdeaStageValue | null) {
  const stageBucket = getStageBucket(stage);

  if (score >= 85) {
    return {
      helper:
        stageBucket === "early"
          ? "Unusually coherent for an early idea"
          : stageBucket === "mid"
            ? "Strong enough for a disciplined launch test"
            : "Founder ready / investor ready",
      label: "Strong",
      ring: "border-[#2ecc71]/24 bg-[#2ecc71]/10 text-[#8be4b2]",
      text: "text-[#8be4b2]",
      bar: "from-[#2ecc71] to-[#7ce7a8]",
    };
  }

  if (score >= 70) {
    return {
      helper:
        stageBucket === "early"
          ? "Clear enough to justify real user tests"
          : stageBucket === "mid"
            ? "Worth a disciplined live test"
            : "Worth a real-world test",
      label: "Resilient",
      ring: "border-[#4c8dff]/24 bg-[#4c8dff]/10 text-[#9fc0ff]",
      text: "text-[#9fc0ff]",
      bar: "from-[#4c8dff] to-[#7fb0ff]",
    };
  }

  if (score >= 40) {
    return {
      helper:
        stageBucket === "early"
          ? "Interesting, but still too unproven"
          : stageBucket === "mid"
            ? "Needs sharper proof before launch"
            : "Needs sharper proof",
      label: "Questionable",
      ring: "border-[#ffa940]/24 bg-[#ffa940]/10 text-[#ffcc94]",
      text: "text-[#ffcc94]",
      bar: "from-[#ffa940] to-[#ffd28d]",
    };
  }

  return {
    helper:
      stageBucket === "early"
        ? "Too fuzzy or exposed to trust yet"
        : stageBucket === "mid"
          ? "Not ready for a real launch"
          : "Do not commit yet",
    label: "Fragile",
    ring: "border-[#ff4d4f]/24 bg-[#ff4d4f]/10 text-[#ff9a9c]",
    text: "text-[#ff9a9c]",
    bar: "from-[#ff4d4f] to-[#ff8d72]",
  };
}

function buildAdvisorySummary(flags: AdvisoryFlag[]) {
  if (flags.length === 2) {
    return "This is a venture evaluation system, not a substitute for legal or financial advice. Use qualified professionals for compliance, contracts, fundraising, tax, or investment decisions.";
  }

  return flags[0]?.description ?? "";
}

function formatVerdictHeadline(verdict: string) {
  const cleaned = verdict.trim().replace(/[.!?]+$/, "");
  const lowered = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);

  if (lowered.startsWith("needs ")) {
    return `This venture ${lowered}`;
  }

  return `This venture is ${lowered}`;
}

function buildDecisionGuidance(score: number, stage: IdeaStageValue | null) {
  const stageBucket = getStageBucket(stage);

  if (score >= 85) {
    if (stageBucket === "early") {
      return "This is strong for an early-stage concept, but it still deserves market proof before it deserves real capital or team build-out.";
    }

    return "Even strong concepts should not absorb real capital until at least two proof conditions are met in the market.";
  }

  if (score >= 70) {
    if (stageBucket === "early") {
      return "This is clear enough to test, but do not confuse a coherent story with proof. Get two real proof conditions before committing harder.";
    }

    return "Do not scale this until at least two proof conditions are met with real users, not founder intuition.";
  }

  if (score >= 40) {
    if (stageBucket === "early") {
      return "Treat this as a proof checklist, not a rejection. Tighten the wedge and test the weakest assumption before you commit serious time or money.";
    }

    return "Do not commit time or capital until at least two proof conditions are met and the weakest assumption survives contact with users.";
  }

  if (stageBucket === "early") {
    return "Right now this reads more fuzzy than impossible. Sharpen the user, wedge, and test path before treating the idea like a venture.";
  }

  return "Do not commit time or capital until at least two proof conditions are met and the core break point stops showing up in live tests.";
}

function buildProofSummary(stage: IdeaStageValue | null) {
  const stageBucket = getStageBucket(stage);

  if (stageBucket === "early") {
    return "This idea needs proof that a specific user feels the pain, understands the wedge, and will change behavior enough to test it.";
  }

  if (stageBucket === "mid") {
    return "This venture needs proof of willingness to pay, repeat use, and a channel that does not depend on founder-only hustle.";
  }

  return "This venture needs proof of customer pull, repeat usage, and a repeatable channel before real commitment.";
}

function buildPhaseAnnouncement(
  phase: WorkflowPhase,
  stage: IdeaStageValue | null,
  questionIndex: number,
  questionCount: number,
  breakdown: AnalysisBreakdown | null,
) {
  if (phase === "define") {
    return "Venture intake. Describe what you are building.";
  }

  if (phase === "calibrate") {
    return "Stage calibration. Choose how developed the idea is.";
  }

  if (phase === "clarify-loading") {
    return "Preparing pressure questions.";
  }

  if (phase === "clarify") {
    const current = Math.min(questionIndex + 1, questionCount || 1);
    const stageLabel = stage ? ` ${getIdeaStageLabel(stage)} lens.` : "";
    return `Clarification question ${current} of ${questionCount || 1}.${stageLabel}`;
  }

  if (phase === "processing") {
    return "Pressure test running. Preparing the evaluation memo.";
  }

  if (phase === "verdict") {
    return breakdown ? `Verdict ready. ${breakdown.verdict}. Score ${breakdown.invincibility_score} out of 100.` : "Verdict ready.";
  }

  return "Full venture breakdown ready.";
}

function getVoiceTargetLabel(target: VoiceTarget) {
  if (target === "idea") {
    return "venture idea";
  }

  if (target === "stage_note") {
    return "stage context";
  }

  return "clarification answer";
}

function buildPageHeading(
  phase: WorkflowPhase,
  stage: IdeaStageValue | null,
  questionIndex: number,
  questionCount: number,
  breakdown: AnalysisBreakdown | null,
) {
  if (phase === "define") {
    return "BreakPoint AI venture intake";
  }

  if (phase === "calibrate") {
    return "BreakPoint AI venture stage calibration";
  }

  if (phase === "clarify-loading") {
    return "BreakPoint AI preparing clarification questions";
  }

  if (phase === "clarify") {
    return `BreakPoint AI clarification question ${Math.min(questionIndex + 1, questionCount || 1)} of ${questionCount || 1}${
      stage ? ` for ${getIdeaStageLabel(stage)}` : ""
    }`;
  }

  if (phase === "processing") {
    return "BreakPoint AI pressure test in progress";
  }

  if (phase === "verdict") {
    return breakdown ? `BreakPoint AI verdict: ${breakdown.verdict}` : "BreakPoint AI verdict";
  }

  return breakdown ? `BreakPoint AI evaluation memo: ${breakdown.verdict}` : "BreakPoint AI evaluation memo";
}

function joinIds(...ids: Array<string | null | undefined>) {
  const filtered = ids.filter(Boolean);
  return filtered.length ? filtered.join(" ") : undefined;
}

type BreakpointSoundCue =
  | "tap"
  | "select"
  | "commit"
  | "crumble"
  | "copy"
  | "verdict"
  | "voice-on"
  | "voice-off";

function playTone(
  context: AudioContext,
  destination: AudioNode,
  {
    duration,
    frequency,
    gain,
    start,
    type = "sine",
  }: {
    duration: number;
    frequency: number;
    gain: number;
    start: number;
    type?: OscillatorType;
  },
) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.62), start + duration);
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gainNode);
  gainNode.connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playNoiseBurst(
  context: AudioContext,
  destination: AudioNode,
  {
    duration,
    start,
    gain,
  }: {
    duration: number;
    start: number;
    gain: number;
  },
) {
  const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * duration)), context.sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let index = 0; index < channelData.length; index += 1) {
    const fade = 1 - index / channelData.length;
    channelData[index] = (Math.random() * 2 - 1) * fade;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gainNode = context.createGain();

  source.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.setValueAtTime(520, start);
  gainNode.gain.setValueAtTime(gain, start);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(destination);
  source.start(start);
  source.stop(start + duration + 0.01);
}

function triggerSoundCue(context: AudioContext, cue: BreakpointSoundCue) {
  const output = context.createGain();
  output.gain.value = 0.42;
  output.connect(context.destination);
  const now = context.currentTime + 0.01;

  if (cue === "tap") {
    playTone(context, output, { start: now, duration: 0.1, frequency: 520, gain: 0.015, type: "triangle" });
    playTone(context, output, { start: now + 0.035, duration: 0.08, frequency: 392, gain: 0.011, type: "triangle" });
  }

  if (cue === "select") {
    playTone(context, output, { start: now, duration: 0.08, frequency: 466, gain: 0.012, type: "triangle" });
    playTone(context, output, { start: now + 0.03, duration: 0.09, frequency: 622, gain: 0.01, type: "triangle" });
  }

  if (cue === "commit") {
    playTone(context, output, { start: now, duration: 0.12, frequency: 310, gain: 0.02, type: "triangle" });
    playTone(context, output, { start: now + 0.04, duration: 0.16, frequency: 196, gain: 0.015, type: "sine" });
  }

  if (cue === "crumble") {
    playNoiseBurst(context, output, { start: now, duration: 0.24, gain: 0.018 });
    playTone(context, output, { start: now + 0.02, duration: 0.16, frequency: 240, gain: 0.024, type: "triangle" });
    playTone(context, output, { start: now + 0.14, duration: 0.18, frequency: 176, gain: 0.019, type: "triangle" });
    playTone(context, output, { start: now + 0.28, duration: 0.22, frequency: 128, gain: 0.016, type: "sine" });
  }

  if (cue === "copy") {
    playTone(context, output, { start: now, duration: 0.11, frequency: 659, gain: 0.015, type: "triangle" });
    playTone(context, output, { start: now + 0.04, duration: 0.12, frequency: 880, gain: 0.012, type: "triangle" });
  }

  if (cue === "verdict") {
    playTone(context, output, { start: now, duration: 0.32, frequency: 164, gain: 0.026, type: "sine" });
    playTone(context, output, { start: now + 0.08, duration: 0.28, frequency: 246, gain: 0.018, type: "triangle" });
  }

  if (cue === "voice-on") {
    playTone(context, output, { start: now, duration: 0.12, frequency: 392, gain: 0.018, type: "triangle" });
    playTone(context, output, { start: now + 0.06, duration: 0.12, frequency: 523, gain: 0.016, type: "triangle" });
  }

  if (cue === "voice-off") {
    playTone(context, output, { start: now, duration: 0.14, frequency: 392, gain: 0.015, type: "triangle" });
    playTone(context, output, { start: now + 0.04, duration: 0.16, frequency: 262, gain: 0.013, type: "triangle" });
  }
}

function getIdeaStageLabel(stage: IdeaStageValue | null) {
  return ideaStages.find((entry) => entry.value === stage)?.label ?? "";
}

function AdvisoryNotice({ flags, compact = false }: { flags: AdvisoryFlag[]; compact?: boolean }) {
  if (!flags.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-[22px] border border-[#ffa940]/18 bg-[#ffa940]/[0.08] text-foreground shadow-[0_18px_50px_rgba(0,0,0,0.16)]",
        compact ? "px-4 py-3" : "px-4 py-4",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 text-[#ffbf78]">
          <TriangleAlert className="h-4 w-4" />
          <span className="font-mono text-[11px] uppercase tracking-[0.22em]">Venture-only caution</span>
        </div>
        {flags.map((flag) => (
          <Badge key={flag.kind} variant="warning" className="w-fit">
            {flag.label}
          </Badge>
        ))}
      </div>
      <p className={cn("mt-3 text-sm text-foreground/84", compact ? "leading-6" : "leading-7")}>
        {buildAdvisorySummary(flags)}
      </p>
    </div>
  );
}

function QuestionProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex flex-col items-center gap-3" aria-label={`Question ${current} of ${total}`} role="status">
      <div className="flex items-center gap-2.5">
        {Array.from({ length: total }).map((_, index) => {
          const number = index + 1;
          const complete = number < current;
          const active = number === current;

          return (
            <div
              key={number}
              className={cn(
                "h-2.5 rounded-full transition-all duration-300",
                active && "w-8 bg-[#4c8dff] shadow-[0_0_0_1px_rgba(76,141,255,0.24)]",
                complete && "w-2.5 bg-white/54",
                !active && !complete && "w-2.5 bg-white/18",
              )}
            />
          );
        })}
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-foreground/46">
        Q{current} of {total}
      </div>
      <span className="sr-only">Clarification progress: question {current} of {total}.</span>
    </div>
  );
}

function ClarifyLoadingPanel({
  idea,
  message,
  stageLabel,
}: {
  idea: string;
  message: string;
  stageLabel?: string;
}) {
  return (
    <Card className="bp-stage-card mx-auto flex w-full max-w-[1020px] flex-col justify-center border-white/10 bg-[linear-gradient(180deg,rgba(20,24,32,0.96),rgba(8,10,14,0.98))]">
      <CardHeader className="bp-stage-header items-center pb-4 text-center">
        <Badge className="w-fit">Clarify</Badge>
        <CardTitle className="bp-stage-title text-balance text-[1.9rem] sm:text-[2.15rem]">
          Targeting the right questions.
        </CardTitle>
        <CardDescription className="bp-stage-desc max-w-2xl text-balance text-[15px]">
          The system is isolating the assumptions this venture depends on.
        </CardDescription>
      </CardHeader>
      <CardContent className="bp-stage-content flex flex-col items-center gap-5">
        <div className="w-full max-w-[820px] rounded-[22px] border border-white/10 bg-[#0b0f15]/88 px-4 py-3 text-sm leading-6 text-foreground/80">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Venture Under Test
            </div>
            {stageLabel ? (
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/58">
                {stageLabel}
              </div>
            ) : null}
          </div>
          <p className="mt-2 break-words">{idea}</p>
        </div>

        <div className="w-full max-w-[820px] rounded-[28px] border border-white/10 bg-[#0b0f15]/92 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Clarification pass
          </div>
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-[1.15rem] font-medium tracking-[-0.03em] text-foreground"
          >
            {message}
          </motion.div>
          <div className="mt-5 overflow-hidden rounded-full border border-white/8 bg-white/[0.04]">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "140%" }}
              transition={{ duration: 1.3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              className="h-2 w-1/3 bg-[linear-gradient(90deg,rgba(255,77,79,0),rgba(255,77,79,0.65),rgba(76,141,255,0.62),rgba(255,77,79,0))]"
            />
          </div>
          <div className="mt-5 flex items-center gap-2.5">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                animate={{ opacity: [0.28, 1, 0.28], scale: [0.96, 1.06, 0.96] }}
                transition={{ duration: 1.15, repeat: Number.POSITIVE_INFINITY, delay: index * 0.14 }}
                className="h-2.5 w-2.5 rounded-full bg-[#9fc0ff]"
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClarificationCard({
  answer,
  answerRef,
  current,
  descriptionId,
  errorId,
  interactive = true,
  onAnswerChange,
  onReset,
  onSubmit,
  question,
  questionId,
  statusSlot,
  statusId,
  textareaId,
  textareaInvalid,
  total,
  voiceControl,
}: {
  answer: string;
  answerRef?: React.Ref<HTMLTextAreaElement>;
  current: number;
  descriptionId?: string;
  errorId?: string;
  interactive?: boolean;
  onAnswerChange?: (value: string) => void;
  onReset?: () => void;
  onSubmit?: () => void;
  question: string;
  questionId?: string;
  statusSlot?: React.ReactNode;
  statusId?: string;
  textareaId?: string;
  textareaInvalid?: boolean;
  total: number;
  voiceControl?: React.ReactNode;
}) {
  const labelId = textareaId ? `${textareaId}-label` : undefined;

  return (
    <Card className="overflow-hidden border-white/12 bg-[#0b0f15]/98 shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="pressure" className="w-fit">
            Question {current} of {total}
          </Badge>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {voiceControl}
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Pressure Point
            </div>
          </div>
        </div>
        <CardTitle
          id={questionId}
          className="pr-2 text-[1.05rem] leading-[1.22] text-foreground [overflow-wrap:anywhere] sm:text-[1.26rem] lg:text-[1.4rem]"
        >
          {question}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {textareaId ? (
          <label id={labelId} htmlFor={textareaId} className="sr-only">
            Answer for question {current} of {total}
          </label>
        ) : null}
        <Textarea
          id={textareaId}
          ref={answerRef}
          value={answer}
          onChange={(event) => onAnswerChange?.(event.target.value)}
          placeholder="Answer directly. No filler."
          disabled={!interactive}
          aria-describedby={joinIds(questionId, descriptionId, statusId, errorId)}
          aria-invalid={textareaInvalid || undefined}
          aria-labelledby={joinIds(labelId, questionId)}
          className={cn(
            "min-h-[126px] border-white/8 bg-white/[0.02] text-[15px] leading-7",
            !interactive && "pointer-events-none opacity-80",
          )}
        />
        {statusSlot ? (
          <div id={statusId} className="mt-3" aria-live="polite">
            {statusSlot}
          </div>
        ) : null}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div id={descriptionId} className="min-w-0 text-sm leading-6 text-foreground/80">
            {interactive
              ? "This answer changes the final evaluation memo."
              : "The next prompt is moving into place."}
          </div>
          {interactive ? (
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button variant="secondary" onClick={onReset} className="w-full whitespace-normal sm:w-auto">
                Start Over
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button size="lg" onClick={onSubmit} className="w-full whitespace-normal sm:w-auto">
                {current === total ? "Pressure Test Venture" : "Lock Answer"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function CrumbleQuestion({
  children,
  onComplete,
}: {
  children: React.ReactNode;
  onComplete: () => void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(onComplete, 1320);
    return () => window.clearTimeout(timeout);
  }, [onComplete]);

  return (
    <div className="relative z-20">
      <div className="invisible" aria-hidden="true">
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0">
        {crumblePolygons.map((polygon, index) => (
          <motion.div
            key={polygon}
            style={{ clipPath: polygon as never }}
            initial={{ opacity: 1, rotate: 0, x: 0, y: 0 }}
            animate={{
              opacity: 0,
              rotate: (index - 2.5) * 4.5,
              x: (index % 2 === 0 ? -24 : 24) + index * 3,
              y: 540 + index * 66,
            }}
            transition={{ duration: 1.56, ease: [0.2, 0.82, 0.34, 1], delay: index * 0.026 }}
            className="absolute inset-0 overflow-hidden"
          >
            {children}
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0.22 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.62, ease: "easeOut" }}
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_72%)]"
        />
      </div>
    </div>
  );
}

function FinalFractureOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-[30px]">
      {[0, 1, 2, 3].map((index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scaleY: 0.5 }}
          animate={{ opacity: [0, 0.5, 0], scaleY: 1 }}
          transition={{ duration: 0.7, delay: index * 0.05, ease: "easeOut" }}
          className="absolute top-0 h-full w-px bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0),rgba(255,255,255,0.08))]"
          style={{ left: `${18 + index * 21}%` }}
        />
      ))}
      {[0, 1, 2].map((index) => (
        <motion.div
          key={`shard-${index}`}
          initial={{ opacity: 0.18, y: 0 }}
          animate={{ opacity: 0, y: 160 + index * 24, rotate: index % 2 === 0 ? -4 : 4 }}
          transition={{ duration: 0.76, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-[12%] rounded-[24px] border border-white/6 bg-white/[0.025]"
          style={{ top: `${18 + index * 20}%`, height: `${18 - index * 2}%` }}
        />
      ))}
    </div>
  );
}

function OnboardingOverlay({
  onClose,
  onNext,
  step,
  stepIndex,
  totalSteps,
}: {
  onClose: () => void;
  onNext: () => void;
  step: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
}) {
  const Icon = step.icon;
  const isLastStep = stepIndex === totalSteps - 1;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog || typeof window === "undefined") {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frame = window.requestAnimationFrame(() => {
      dialog.focus();
    });

    const getFocusableElements = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null && element.getAttribute("aria-hidden") !== "true");

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();

      if (!focusableElements.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === dialog) {
          event.preventDefault();
          last.focus();
        }

        return;
      }

      if (active === dialog) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleKeydown);

    return () => {
      window.cancelAnimationFrame(frame);
      dialog.removeEventListener("keydown", handleKeydown);
      previousFocusRef.current?.focus?.();
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[70] overflow-y-auto bg-[rgba(5,7,10,0.74)] px-3 py-3 backdrop-blur-md sm:px-4 sm:py-5"
    >
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="breakpoint-onboarding-title"
        aria-describedby="breakpoint-onboarding-body"
        tabIndex={-1}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto my-auto w-full max-w-[980px] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,32,0.97),rgba(8,10,14,0.99))] shadow-[0_36px_120px_rgba(0,0,0,0.44)] sm:rounded-[32px]"
        style={{ maxHeight: "calc(100dvh - 1.5rem)" }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,77,79,0.15),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(76,141,255,0.16),transparent_36%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />

        <div className="relative grid max-h-[inherit] gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1.02fr)_360px]">
          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="pressure" className="w-fit">
                How BreakPoint Works
              </Badge>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/56">
                {step.eyebrow}
              </div>
            </div>

            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="mt-5 sm:mt-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.05] text-[#ffb08f] shadow-[0_0_40px_rgba(255,96,82,0.12)] sm:h-14 sm:w-14 sm:rounded-[18px]">
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h2
                id="breakpoint-onboarding-title"
                className="mt-5 max-w-[16ch] text-balance text-[1.68rem] font-semibold leading-[0.98] tracking-[-0.05em] text-foreground sm:mt-6 sm:text-[2.4rem]"
              >
                {step.title}
              </h2>
              <p
                id="breakpoint-onboarding-body"
                className="mt-3 max-w-[34rem] text-[14px] leading-7 text-foreground/80 sm:mt-4 sm:text-[15px] sm:leading-8"
              >
                {step.body}
              </p>
            </motion.div>

            <div className="mt-6 flex flex-wrap items-center gap-2.5 sm:mt-8">
              {onboardingSteps.map((entry, index) => (
                <div
                  key={entry.title}
                  className={cn(
                    "h-2.5 rounded-full transition-all duration-300",
                    index === stepIndex ? "w-9 bg-[#ff8c4a]" : "w-2.5 bg-white/16",
                  )}
                />
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="secondary" onClick={onClose} className="w-full whitespace-normal sm:w-auto">
                Skip intro
              </Button>
              <Button size="lg" onClick={onNext} className="w-full whitespace-normal sm:w-auto">
                {isLastStep ? "Start pressure test" : "Next step"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="relative border-t border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-foreground/48">
              Pressure path
            </div>
            <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
              {[
                "Enter the idea or plan",
                "Calibrate the venture stage",
                "Answer the pressure questions",
                "Get the score and memo",
              ].map((label, index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, delay: index * 0.05 }}
                  className={cn(
                    "rounded-[18px] border px-3.5 py-3 sm:rounded-[20px] sm:px-4",
                    index <= stepIndex
                      ? "border-white/12 bg-white/[0.06] text-foreground"
                      : "border-white/8 bg-white/[0.025] text-foreground/56",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "inline-flex h-7 min-w-[1.8rem] items-center justify-center rounded-full font-mono text-[10px] uppercase tracking-[0.16em] sm:h-8 sm:min-w-[2rem]",
                        index <= stepIndex ? "bg-[#ff8c4a] text-black" : "bg-white/[0.06] text-foreground/60",
                      )}
                    >
                      {index + 1}
                    </div>
                    <div className="text-sm leading-6">{label}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-5 rounded-[22px] border border-[#4c8dff]/14 bg-[#4c8dff]/[0.08] p-3.5 sm:mt-6 sm:rounded-[24px] sm:p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#9fc0ff]">
                What you get
              </div>
              <p className="mt-2.5 text-sm leading-6 text-foreground/82 sm:mt-3 sm:leading-7">
                BreakPoint gives you an Invincibility Score, the core break point, proof required before launch, and the full memo behind the verdict.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function BreakpointApp() {
  const [phase, setPhase] = useState<WorkflowPhase>("define");
  const [idea, setIdea] = useState("");
  const [ideaStage, setIdeaStage] = useState<IdeaStageValue | null>(null);
  const [stageNote, setStageNote] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [leavingQuestion, setLeavingQuestion] = useState<LeavingQuestion | null>(null);
  const [finalTransitioning, setFinalTransitioning] = useState(false);
  const [breakdown, setBreakdown] = useState<AnalysisBreakdown | null>(null);
  const [pendingAction, setPendingAction] = useState<"clarify" | "analyze" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [voiceTarget, setVoiceTarget] = useState<VoiceTarget | null>(null);
  const [clarifyLoadingIndex, setClarifyLoadingIndex] = useState(0);
  const [processingMessageIndex, setProcessingMessageIndex] = useState(0);
  const [pendingFinalAnalysis, setPendingFinalAnalysis] = useState<PendingAnalysisState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStepIndex, setOnboardingStepIndex] = useState(0);
  const [liveAnnouncement, setLiveAnnouncement] = useState("Venture intake. Describe what you are building.");

  const ideaTextareaRef = useRef<HTMLTextAreaElement>(null);
  const stageNoteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const clarifyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const verdictHeadingRef = useRef<HTMLHeadingElement>(null);
  const analysisHeadingRef = useRef<HTMLHeadingElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const pendingNextQuestionRef = useRef<number | null>(null);
  const queuedVoiceTargetRef = useRef<VoiceTarget | null>(null);
  const voiceTargetRef = useRef<VoiceTarget | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);
  const soundPreferenceHydratedRef = useRef(false);
  const verdictCuePlayedRef = useRef(false);
  const onboardingHydratedRef = useRef(false);

  const isVerdictPhase = phase === "verdict" && breakdown !== null;
  const isAnalysisPhase = phase === "analysis" && breakdown !== null;
  const allowsStageScroll =
    phase === "calibrate" ||
    phase === "clarify-loading" ||
    phase === "clarify" ||
    phase === "processing" ||
    isVerdictPhase ||
    isAnalysisPhase;
  const currentStep =
    phase === "define"
      ? 1
      : phase === "calibrate" || phase === "clarify-loading" || phase === "clarify"
        ? 2
        : phase === "processing"
          ? 3
          : phase === "verdict"
            ? 4
            : 5;
  const activeQuestion = questions[currentQuestionIndex] ?? null;

  const clarificationPairs: ClarificationPair[] = questions
    .map((question, index) => ({
      question,
      answer: answers[index]?.trim() ?? "",
    }))
    .filter((entry) => entry.answer.length > 0);

  const advisoryFlags = useMemo(
    () => detectAdvisoryFlags([idea, stageNote, ...answers, currentAnswer].filter(Boolean).join("\n")),
    [answers, currentAnswer, idea, stageNote],
  );
  const scoreTone = breakdown ? getScoreTone(breakdown.invincibility_score, ideaStage) : null;
  const verdictHeadline = breakdown ? formatVerdictHeadline(breakdown.verdict) : "";
  const decisionGuidance = breakdown ? buildDecisionGuidance(breakdown.invincibility_score, ideaStage) : "";
  const proofSummary = buildProofSummary(ideaStage);
  const activeOnboardingStep = onboardingSteps[onboardingStepIndex] ?? onboardingSteps[0];
  const pageHeading = buildPageHeading(phase, ideaStage, currentQuestionIndex, questions.length, breakdown);
  const errorId = error ? `workflow-error-${phase}` : undefined;
  const ideaFieldInvalid = phase === "define" && Boolean(error?.includes("What are you thinking of building?"));
  const stageFieldInvalid =
    phase === "calibrate" && Boolean(error?.includes("Choose how developed the idea is before continuing"));
  const answerFieldInvalid = phase === "clarify" && Boolean(error?.includes("Answer directly before moving"));
  const clarifyFieldId = activeQuestion ? `clarify-answer-${currentQuestionIndex + 1}` : undefined;
  const clarifyQuestionId = activeQuestion ? `clarify-question-${currentQuestionIndex + 1}` : undefined;
  const clarifyDescriptionId = activeQuestion ? `clarify-answer-description-${currentQuestionIndex + 1}` : undefined;
  const clarifyVoiceStatusId = activeQuestion ? `clarify-voice-status-${currentQuestionIndex + 1}` : undefined;

  function playSound(cue: BreakpointSoundCue) {
    if (!soundEnabledRef.current || typeof window === "undefined") {
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    const context = audioContextRef.current ?? new AudioContextConstructor();
    audioContextRef.current = context;

    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    triggerSoundCue(context, cue);
  }

  useEffect(() => {
    const SpeechRecognitionConstructor =
      typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

    if (!SpeechRecognitionConstructor) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechError(null);
      playSound("voice-on");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      const queuedTarget = queuedVoiceTargetRef.current;
      queuedVoiceTargetRef.current = null;

      if (queuedTarget && recognitionRef.current) {
        voiceTargetRef.current = queuedTarget;
        setVoiceTarget(queuedTarget);

        try {
          recognitionRef.current.start();
          return;
        } catch {
          setSpeechError("Voice capture ran into a browser error. Try again.");
        }
      }

      voiceTargetRef.current = null;
      setVoiceTarget(null);
      playSound("voice-off");
    };

    recognition.onerror = (event) => {
      const message =
        event.error === "not-allowed"
          ? "Microphone access was blocked. Allow mic access to dictate your venture idea."
          : event.error === "no-speech"
            ? "No speech was detected. Try again and speak a little closer to the mic."
            : "Voice capture ran into a browser error. Try again.";

      setSpeechError(message);
      setIsListening(false);
      queuedVoiceTargetRef.current = null;
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let liveTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript ?? "";

        if (event.results[index].isFinal) {
          finalTranscript += transcript;
        } else {
          liveTranscript += transcript;
        }
      }

      const nextTarget = voiceTargetRef.current;

      if (finalTranscript.trim() && nextTarget) {
        const normalizedTranscript = finalTranscript.trim();

        if (nextTarget === "idea") {
          setIdea((current) => {
            const prefix = current.trim();
            return prefix
              ? `${prefix}${prefix.endsWith(" ") ? "" : " "}${normalizedTranscript}`
              : normalizedTranscript;
          });
        }

        if (nextTarget === "stage_note") {
          setStageNote((current) => {
            const prefix = current.trim();
            const merged = prefix
              ? `${prefix}${prefix.endsWith(" ") ? "" : " "}${normalizedTranscript}`
              : normalizedTranscript;
            return merged.slice(0, 240);
          });
        }

        if (nextTarget === "clarify") {
          setCurrentAnswer((current) => {
            const prefix = current.trim();
            return prefix
              ? `${prefix}${prefix.endsWith(" ") ? "" : " "}${normalizedTranscript}`
              : normalizedTranscript;
          });
        }
      }

      setInterimTranscript(liveTranscript.trim());
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedPreference = window.localStorage.getItem("breakpoint-sound-enabled");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setSoundEnabled(savedPreference ? savedPreference === "true" : !reduceMotion);
    soundPreferenceHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || onboardingHydratedRef.current) {
      return;
    }

    onboardingHydratedRef.current = true;

    if (window.localStorage.getItem("breakpoint-onboarding-seen") !== "true") {
      setShowOnboarding(true);
      setOnboardingStepIndex(0);
    }
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !soundPreferenceHydratedRef.current) {
      return;
    }

    window.localStorage.setItem("breakpoint-sound-enabled", String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    if (copyState !== "copied") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopyState("idle");
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [copyState]);

  useEffect(() => {
    if (phase !== "clarify-loading") {
      return;
    }

    const interval = window.setInterval(() => {
      setClarifyLoadingIndex((current) => (current + 1) % clarifyLoadingMessages.length);
    }, 1100);

    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== "processing") {
      return;
    }

    const interval = window.setInterval(() => {
      setProcessingMessageIndex((current) => (current + 1) % processingMessages.length);
    }, 1350);

    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });

      if (phase === "verdict") {
        verdictHeadingRef.current?.focus();
      }

      if (phase === "analysis") {
        analysisHeadingRef.current?.focus();
      }
    });
  }, [phase]);

  useEffect(() => {
    setLiveAnnouncement(buildPhaseAnnouncement(phase, ideaStage, currentQuestionIndex, questions.length, breakdown));
  }, [breakdown, currentQuestionIndex, ideaStage, phase, questions.length]);

  useEffect(() => {
    if (phase === "verdict" && breakdown && !verdictCuePlayedRef.current) {
      playSound("verdict");
      verdictCuePlayedRef.current = true;
      return;
    }

    if (phase !== "verdict") {
      verdictCuePlayedRef.current = false;
    }
  }, [breakdown, phase]);

  const dismissOnboarding = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("breakpoint-onboarding-seen", "true");
    }

    playSound("tap");
    setShowOnboarding(false);
    setOnboardingStepIndex(0);

    window.setTimeout(() => {
      ideaTextareaRef.current?.focus();
    }, 80);
  }, []);

  const advanceOnboarding = useCallback(() => {
    if (onboardingStepIndex >= onboardingSteps.length - 1) {
      dismissOnboarding();
      return;
    }

    playSound("tap");
    setOnboardingStepIndex((current) => Math.min(current + 1, onboardingSteps.length - 1));
  }, [dismissOnboarding, onboardingStepIndex]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (showOnboarding) {
        if (event.key === "Escape") {
          event.preventDefault();
          dismissOnboarding();
        }

        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();

        if (pendingAction) {
          return;
        }

        if (phase === "define") {
          moveToCalibration();
        }

        if (phase === "calibrate") {
          void requestClarifications(idea, ideaStage, stageNote);
        }

        if (phase === "clarify") {
          submitCurrentQuestion();
        }
      }

      if (event.key === "Escape") {
        setError(null);
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [dismissOnboarding, idea, ideaStage, pendingAction, phase, showOnboarding, stageNote]);

  useEffect(() => {
    if (phase !== "processing" || !pendingFinalAnalysis) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const finalAnswers = pendingFinalAnalysis;
      setPendingFinalAnalysis(null);
      setProcessingMessageIndex(0);

      void (async () => {
        try {
          const payload = await fetchAnalysisBreakdown(idea, ideaStage, stageNote, finalAnswers.answers);
          setBreakdown(payload);
          setPhase("verdict");
        } catch (requestError) {
          setPhase("clarify");
          setCurrentQuestionIndex(Math.max(questions.length - 1, 0));
          setCurrentAnswer(finalAnswers.lastAnswer);
          setError(
            requestError instanceof Error ? requestError.message : "The system could not complete the breakdown.",
          );
        } finally {
          setPendingAction(null);
        }
      })();
    }, 360);

    return () => window.clearTimeout(timeout);
  }, [idea, ideaStage, pendingFinalAnalysis, phase, questions.length, stageNote]);

  function moveToCalibration() {
    const nextIdea = idea.trim();

    if (nextIdea.length < 20) {
      setError("What are you thinking of building? Give the system enough venture detail to pressure.");
      return;
    }

    playSound("tap");
    recognitionRef.current?.stop();
    setIdea(nextIdea);
    setError(null);
    setPhase("calibrate");

    window.setTimeout(() => {
      stageNoteTextareaRef.current?.focus();
    }, 120);
  }

  async function requestClarifications(sourceIdea: string, stage: IdeaStageValue | null, note: string) {
    const nextIdea = sourceIdea.trim();
    const nextStage = stage;
    const nextStageNote = note.trim();

    if (nextIdea.length < 20) {
      setError("What are you thinking of building? Give the system enough venture detail to pressure.");
      return;
    }

    if (!nextStage) {
      setError("Choose how developed the idea is before continuing to pressure points.");
      return;
    }

    const startedAt = Date.now();

    playSound("tap");
    recognitionRef.current?.stop();
    setPendingAction("clarify");
    setError(null);
    setCopyState("idle");
    setLeavingQuestion(null);
    setFinalTransitioning(false);
    setPendingFinalAnalysis(null);
    pendingNextQuestionRef.current = null;
    setClarifyLoadingIndex(0);
    setPhase("clarify-loading");

    try {
      const payload = await postApiJson<ClarifyResponse & { error?: string }>(
        "/api/clarify",
        { idea: nextIdea, stage: nextStage, stage_note: nextStageNote },
        "The system could not generate clarification questions.",
      );

      const elapsed = Date.now() - startedAt;
      const minimumDelay = 500;

      if (elapsed < minimumDelay) {
        await new Promise((resolve) => window.setTimeout(resolve, minimumDelay - elapsed));
      }

      setIdea(nextIdea);
      setIdeaStage(nextStage);
      setStageNote(nextStageNote);
      setQuestions(payload.questions);
      setAnswers(new Array(payload.questions.length).fill(""));
      setCurrentQuestionIndex(0);
      setCurrentAnswer("");
      setBreakdown(null);
      setPhase("clarify");

      window.setTimeout(() => {
        clarifyTextareaRef.current?.focus();
      }, 160);
    } catch (requestError) {
      setPhase("define");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The system could not generate clarification questions.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function fetchAnalysisBreakdown(
    sourceIdea: string,
    stage: IdeaStageValue | null,
    note: string,
    sourceAnswers: ClarificationPair[],
  ) {
    const nextIdea = sourceIdea.trim();
    const normalizedAnswers = sourceAnswers.map((entry) => ({
      question: entry.question,
      answer: entry.answer.trim(),
    }));

    if (normalizedAnswers.some((entry) => entry.answer.length < 3)) {
      throw new Error("Answer each clarification before applying pressure.");
    }

    if (!stage) {
      throw new Error("Choose how developed the idea is before running the full pressure test.");
    }

    const requestBody: AnalyzeRequestPayload = {
      idea: nextIdea,
      stage,
      stage_note: note.trim(),
      answers: normalizedAnswers,
    };

    const payload = await postApiJson<AnalysisBreakdown & { error?: string }>(
      "/api/analyze",
      requestBody,
      "The system could not complete the breakdown.",
    );

    return payload;
  }

  async function copyBreakdown() {
    if (!breakdown) {
      return;
    }

    try {
      await navigator.clipboard.writeText(formatBreakdownForCopy(idea, clarificationPairs, breakdown));
      setCopyState("copied");
      playSound("copy");
    } catch {
      setCopyState("failed");
    }
  }

  function submitCurrentQuestion() {
    if (!activeQuestion || leavingQuestion || pendingAction || finalTransitioning) {
      return;
    }

    const trimmedAnswer = currentAnswer.trim();

    if (trimmedAnswer.length < 3) {
      setError("Answer directly before moving to the next question.");
      return;
    }

    setError(null);
    playSound("commit");
    playSound("crumble");

    const nextAnswers = answers.map((answer, index) => (index === currentQuestionIndex ? trimmedAnswer : answer));
    setAnswers(nextAnswers);

    const updatedPairs = questions
      .map((question, index) => ({
        question,
        answer: (index === currentQuestionIndex ? trimmedAnswer : nextAnswers[index] ?? "").trim(),
      }))
      .filter((entry) => entry.answer.length > 0);

    setLeavingQuestion({
      answer: trimmedAnswer,
      index: currentQuestionIndex,
      question: activeQuestion,
      total: questions.length,
    });

    if (currentQuestionIndex === questions.length - 1) {
      setPendingAction("analyze");
      setPendingFinalAnalysis({
        answers: updatedPairs,
        lastAnswer: trimmedAnswer,
      });
      setFinalTransitioning(true);
      pendingNextQuestionRef.current = null;
      return;
    }

    const nextIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIndex);
    setCurrentAnswer("");
    pendingNextQuestionRef.current = nextIndex;
  }

  function handleQuestionCrumbleComplete() {
    const nextIndex = pendingNextQuestionRef.current;

    if (pendingFinalAnalysis) {
      setLeavingQuestion(null);
      pendingNextQuestionRef.current = null;
      setCurrentAnswer("");
      setFinalTransitioning(false);
      setProcessingMessageIndex(0);
      setPhase("processing");
      return;
    }

    if (nextIndex !== null) {
      setLeavingQuestion(null);
      pendingNextQuestionRef.current = null;

      window.setTimeout(() => {
        clarifyTextareaRef.current?.focus();
      }, 32);
    }
  }

  function resetWorkflow() {
    playSound("tap");
    recognitionRef.current?.abort();
    pendingNextQuestionRef.current = null;
    setPhase("define");
    setIdea("");
    setIdeaStage(null);
    setStageNote("");
    setQuestions([]);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setCurrentAnswer("");
    setLeavingQuestion(null);
    setFinalTransitioning(false);
    setPendingFinalAnalysis(null);
    setBreakdown(null);
    setPendingAction(null);
    setError(null);
    setCopyState("idle");
    setIsListening(false);
    setInterimTranscript("");
    setSpeechError(null);
    setVoiceTarget(null);
    voiceTargetRef.current = null;
    queuedVoiceTargetRef.current = null;

    window.setTimeout(() => {
      ideaTextareaRef.current?.focus();
    }, 100);
  }

  function toggleVoiceCapture(target: VoiceTarget) {
    if (!speechSupported || !recognitionRef.current) {
      setSpeechError("Voice input is not supported in this browser.");
      return;
    }

    if (isListening && voiceTarget === target) {
      queuedVoiceTargetRef.current = null;
      recognitionRef.current.stop();
      return;
    }

    if (isListening && voiceTarget !== target) {
      queuedVoiceTargetRef.current = target;
      recognitionRef.current.stop();
      return;
    }

    setSpeechError(null);
    voiceTargetRef.current = target;
    setVoiceTarget(target);

    try {
      recognitionRef.current.start();
    } catch {
      setSpeechError("Voice capture is already active. Wait a moment and try again.");
    }
  }

  function renderVoiceButton(target: VoiceTarget) {
    const active = isListening && voiceTarget === target;

    return (
      <Button
        type="button"
        size="sm"
        variant={active ? "danger" : "secondary"}
        onClick={() => toggleVoiceCapture(target)}
        disabled={!speechSupported}
        aria-label={`${active ? "Stop" : "Start"} voice input for the ${getVoiceTargetLabel(target)} field`}
      >
        {active ? "Stop Voice" : "Voice Input"}
        {active ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
    );
  }

  function renderVoiceStatus(target: VoiceTarget, statusId?: string) {
    if (voiceTarget !== target) {
      return null;
    }

    return (
      <div id={statusId} className="space-y-3">
        {interimTranscript ? (
          <div className="rounded-full border border-[#ff4d4f]/18 bg-[#ff4d4f]/[0.08] px-3 py-1.5 text-xs text-[#ffb1b3]">
            Live transcript: {interimTranscript}
          </div>
        ) : null}
        {speechError ? (
          <div className="rounded-[18px] border border-[#ff4d4f]/20 bg-[#ff4d4f]/[0.08] px-3 py-2 text-sm text-foreground">
            {speechError}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh]">
      <a
        href="#breakpoint-main"
        className="sr-only absolute left-3 top-3 z-[90] rounded-full border border-white/12 bg-[#0b0f15]/96 px-4 py-2 text-sm text-foreground shadow-[0_18px_50px_rgba(0,0,0,0.26)] focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-[#4c8dff]/60"
      >
        Skip to main content
      </a>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-grid bg-[size:48px_48px] opacity-[0.035]" />
        <div className="absolute left-[-8rem] top-[-8rem] h-80 w-80 rounded-full bg-[#ff4d4f]/12 blur-3xl" />
        <div className="absolute right-[-8rem] top-10 h-72 w-72 rounded-full bg-[#4c8dff]/12 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/3 h-80 w-80 rounded-full bg-[#ffa940]/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent)] opacity-70" />
      </div>
      <CursorTrail />
      <div className="sr-only" aria-atomic="true" aria-live="polite" role="status">
        {liveAnnouncement}
      </div>
      <AnimatePresence>
        {showOnboarding ? (
          <OnboardingOverlay
            onClose={dismissOnboarding}
            onNext={advanceOnboarding}
            step={activeOnboardingStep}
            stepIndex={onboardingStepIndex}
            totalSteps={onboardingSteps.length}
          />
        ) : null}
      </AnimatePresence>

      <div
        className={cn(
          "bp-shell relative z-[1] mx-auto flex min-h-full w-full max-w-[1660px] flex-col px-3 py-2.5 sm:px-5 sm:py-3 lg:px-6",
          isAnalysisPhase ? "bp-shell--analysis" : "",
          allowsStageScroll ? "bp-shell--scroll h-auto min-h-full" : "",
        )}
      >
        <header className="bp-hero relative mb-3 shrink-0 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,20,28,0.92),rgba(9,12,18,0.96))] px-3.5 py-3.5 shadow-[0_32px_90px_rgba(0,0,0,0.42)] sm:px-4 sm:py-4 lg:px-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,77,79,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(76,141,255,0.12),transparent_30%)]" />
          <div
            className={cn(
              "bp-hero-card relative flex flex-col items-start gap-3 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-5",
              phase === "define" ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.012))]" : "",
            )}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-[#ff4d4f]/24 bg-[#ff4d4f]/12 text-[#ff7b7d] shadow-[0_0_40px_rgba(255,77,79,0.14)]">
              <Crosshair className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.34em] text-foreground/55">BREAKPOINT AI</div>
              <p className="bp-hero-copy mt-1 text-sm leading-6 text-muted-foreground">
                Pressure test the venture before the market does.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                setSoundEnabled((current) => {
                  const next = !current;

                  if (!current && next) {
                    window.setTimeout(() => playSound("tap"), 0);
                  }

                  return next;
                })
              }
              className="self-start whitespace-normal sm:ml-auto sm:self-auto"
              aria-pressed={soundEnabled}
              title="Toggle subtle sound cues for question crumble, voice capture, and verdict reveal"
            >
              {soundEnabled ? "Sound On" : "Sound Off"}
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <nav aria-label="Workflow progress" className={cn(phase === "define" ? "hidden sm:block" : "")}>
          <StepProgress currentStep={currentStep} />
        </nav>

        {error ? (
          <section aria-label="Status message" className="mb-3 shrink-0">
            <motion.div
              id={errorId}
              role="alert"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[22px] border border-[#ff4d4f]/20 bg-[#ff4d4f]/10 px-4 py-3 text-sm text-foreground"
            >
              {error}
            </motion.div>
          </section>
        ) : null}

        <motion.main
          id="breakpoint-main"
          aria-labelledby="breakpoint-page-title"
          className={cn(
            "bp-main min-h-[520px] min-w-0",
            allowsStageScroll
              ? "bp-main--scroll block overflow-visible"
              : "flex flex-1 overflow-visible lg:min-h-0",
            isAnalysisPhase ? "bp-main--analysis" : "",
          )}
          initial={false}
        >
          <h1 id="breakpoint-page-title" className="sr-only">
            {pageHeading}
          </h1>
          <AnimatePresence mode="wait">
            {phase === "define" ? (
              <motion.section
                key="define"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={stageTransition}
                className="bp-stage flex w-full min-h-0 items-start justify-center py-2 sm:py-3 lg:py-4"
              >
                <Card className="bp-stage-card mx-auto flex w-full max-w-[940px] flex-col justify-center border-white/10 bg-[linear-gradient(180deg,rgba(20,24,32,0.96),rgba(8,10,14,0.98))]">
                  <CardHeader className="bp-stage-header items-center pb-3 text-center">
                    <Badge variant="pressure" className="w-fit">
                      Venture Intake
                    </Badge>
                    <CardTitle className="bp-stage-title max-w-[16ch] text-balance text-[1.75rem] sm:text-[2.2rem]">
                      What are you thinking of building?
                    </CardTitle>
                    <CardDescription className="bp-stage-desc max-w-[38rem] text-balance text-[15px]">
                      Give the system a startup idea, business model, or investment thesis. The clearer the mechanics, the sharper the breakpoints.
                    </CardDescription>
                    <div className="mt-1 hidden flex-wrap items-center justify-center gap-2.5 sm:flex">
                      {founderFocusAreas.map((area) => (
                        <div
                          key={area}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/66"
                        >
                          {area}
                        </div>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="bp-stage-content flex flex-col items-center gap-5">
                    <div className="bp-intake-panel relative w-full max-w-[820px] rounded-[28px] border border-white/10 bg-[#0b0f15]/94 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-5">
                      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,77,79,0.65),transparent)]" />
                      <div className="absolute right-0 top-0 h-36 w-36 bg-[radial-gradient(circle,rgba(255,77,79,0.12),transparent_72%)]" />
                      <div className="relative flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          Intake Channel
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={isListening && voiceTarget === "idea" ? "danger" : "secondary"}
                          onClick={() => toggleVoiceCapture("idea")}
                          disabled={!speechSupported}
                          aria-label={`${
                            isListening && voiceTarget === "idea" ? "Stop" : "Start"
                          } voice input for the venture idea field`}
                          className="whitespace-normal"
                        >
                          {isListening && voiceTarget === "idea" ? "Stop Voice" : "Voice Input"}
                          {isListening && voiceTarget === "idea" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        </Button>
                      </div>
                      <label htmlFor="venture-intake-field" className="sr-only">
                        Describe the venture idea, business model, or investment thesis.
                      </label>
                      <Textarea
                        id="venture-intake-field"
                        ref={ideaTextareaRef}
                        value={idea}
                        onChange={(event) => setIdea(event.target.value)}
                        placeholder="Describe the venture, who pays, why they switch, how it reaches the market, and what has to be true."
                        aria-describedby={joinIds(
                          "venture-intake-hint",
                          "venture-intake-helper",
                          voiceTarget === "idea" ? "venture-intake-voice-status" : undefined,
                          ideaFieldInvalid ? errorId : undefined,
                        )}
                        aria-invalid={ideaFieldInvalid || undefined}
                        className="bp-idea-textarea mt-4 min-h-[220px] border-white/8 bg-white/[0.02] text-[15px] leading-7"
                      />

                      <div id="venture-intake-hint" className="mt-3">
                        {renderVoiceStatus("idea", "venture-intake-voice-status")}
                      </div>
                      <p id="venture-intake-helper" className="mt-3 text-sm leading-6 text-foreground/68">
                        Start with the buyer, the offer, and why this wins instead of getting ignored.
                      </p>
                    </div>

                    <div className="bp-utility-row w-full max-w-[820px] rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 text-left">
                          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-foreground/42">Next step</div>
                          <p className="mt-1 text-sm leading-6 text-foreground/72">Set the venture stage, then let BreakPoint generate pressure questions.</p>
                        </div>
                        <Button size="lg" onClick={moveToCalibration} className="w-full whitespace-normal sm:w-auto">
                        Calibrate Pressure Test
                        <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {advisoryFlags.length ? (
                      <div className="w-full max-w-[820px]">
                        <AdvisoryNotice flags={advisoryFlags} />
                      </div>
                    ) : null}

                    <div className="flex w-full max-w-[820px] flex-wrap items-center justify-center gap-2.5 pt-1">
                      {sampleIdeas.map((sample) => (
                          <button
                            key={sample.label}
                            type="button"
                            onClick={() => {
                              playSound("select");
                              setIdea(sample.idea);
                              setError(null);
                              window.setTimeout(() => {
                                ideaTextareaRef.current?.focus();
                            }, 40);
                          }}
                          className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5 text-sm text-foreground/62 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.05] hover:text-foreground/78"
                        >
                          {sample.label}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.section>
            ) : null}

            {phase === "calibrate" ? (
              <motion.section
                key="calibrate"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={stageTransition}
                className="bp-stage flex w-full min-h-0 items-start justify-center py-1 sm:py-2 lg:py-3"
              >
                <Card className="bp-stage-card mx-auto flex w-full max-w-[1120px] flex-col justify-center border-white/10 bg-[linear-gradient(180deg,rgba(20,24,32,0.96),rgba(8,10,14,0.98))]">
                  <CardHeader className="bp-stage-header items-center pb-4 text-center">
                    <Badge className="w-fit">Calibration</Badge>
                    <CardTitle className="bp-stage-title text-balance text-[1.72rem] sm:text-[2.1rem]">
                      How developed is this idea right now?
                    </CardTitle>
                    <CardDescription className="bp-stage-desc max-w-2xl text-balance text-[15px]">
                      This helps BreakPoint match the pressure test to your stage instead of assuming the venture is fully built.
                    </CardDescription>
                    <div className="mt-1 flex items-center justify-center gap-2 text-xs text-foreground/54">
                      <span>Stage lens</span>
                      <InfoHint
                        label="Explain how stage calibration works"
                        content="Early ideas get pressure-tested on user clarity, wedge, and testability. More mature ventures get judged harder on proof, retention, monetization, and distribution."
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="bp-stage-content flex flex-col items-center gap-5">
                    <div className="w-full max-w-[940px] rounded-[24px] border border-white/10 bg-[#0b0f15]/88 px-4 py-4 text-sm leading-6 text-foreground/80">
                      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Venture Under Test
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-foreground/84">{idea}</p>
                    </div>

                    <fieldset className="w-full max-w-[940px]" aria-describedby={joinIds("idea-stage-helper", stageFieldInvalid ? errorId : undefined)}>
                      <legend id="idea-stage-legend" className="sr-only">
                        Choose how developed the idea is right now.
                      </legend>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {ideaStages.map((stage) => {
                          const selected = ideaStage === stage.value;

                          return (
                            <button
                              key={stage.value}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => {
                                playSound("select");
                                setIdeaStage(stage.value);
                                setError(null);
                              }}
                              className={cn(
                                "rounded-[24px] border px-4 py-4 text-left transition-all duration-200",
                                selected
                                  ? "border-[#4c8dff]/30 bg-[#4c8dff]/10 shadow-[0_0_0_1px_rgba(76,141,255,0.16),0_16px_42px_rgba(10,18,32,0.22)]"
                                  : "border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-white/16 hover:bg-white/[0.05]",
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 break-words font-medium tracking-[-0.025em] text-foreground">{stage.label}</div>
                                <div
                                  className={cn(
                                    "h-2.5 w-2.5 rounded-full transition-colors",
                                    selected ? "bg-[#4c8dff]" : "bg-white/20",
                                  )}
                                />
                              </div>
                              <p className="mt-3 text-sm leading-6 text-foreground/72">{stage.hint}</p>
                            </button>
                          );
                        })}
                      </div>
                      <p id="idea-stage-helper" className="sr-only">
                        Choose one stage so BreakPoint can ask the right level of pressure questions.
                      </p>
                    </fieldset>

                    <div className="w-full max-w-[940px] rounded-[26px] border border-white/10 bg-[#0b0f15]/92 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          <span>Anything else the system should know before applying pressure?</span>
                          <InfoHint
                            align="left"
                            label="Explain optional stage context"
                            content="Use this for constraints, current traction, audience details, or what still feels fuzzy. It helps the system ask better questions without changing the venture itself."
                          />
                        </div>
                        {renderVoiceButton("stage_note")}
                      </div>
                      <label htmlFor="stage-note-field" className="sr-only">
                        Anything else the system should know before applying pressure?
                      </label>
                      <Textarea
                        id="stage-note-field"
                        ref={stageNoteTextareaRef}
                        value={stageNote}
                        onChange={(event) => setStageNote(event.target.value.slice(0, 240))}
                        placeholder="Optional context: market, audience, current traction, constraints, or what still feels unclear."
                        aria-describedby={joinIds(
                          "stage-note-helper",
                          voiceTarget === "stage_note" ? "stage-note-voice-status" : undefined,
                        )}
                        className="mt-3 min-h-[88px] border-white/8 bg-white/[0.02] text-[14px] leading-6"
                      />
                      <div className="mt-3">{renderVoiceStatus("stage_note", "stage-note-voice-status")}</div>
                      <div id="stage-note-helper" className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/58">
                        <span>Optional. Keep it short and direct.</span>
                        <span>{stageNote.trim().length} / 240</span>
                      </div>
                    </div>

                    {advisoryFlags.length ? (
                      <div className="w-full max-w-[940px]">
                        <AdvisoryNotice flags={advisoryFlags} compact />
                      </div>
                    ) : null}

                    <div className="flex w-full max-w-[940px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Button variant="secondary" onClick={() => setPhase("define")} className="w-full whitespace-normal sm:w-auto">
                        Back to idea
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="lg"
                        onClick={() => void requestClarifications(idea, ideaStage, stageNote)}
                        disabled={!ideaStage || pendingAction === "clarify"}
                        className="w-full whitespace-normal sm:w-auto"
                      >
                        {pendingAction === "clarify" ? "Preparing Pressure Points" : "Continue to pressure points"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.section>
            ) : null}

            {phase === "clarify-loading" ? (
              <motion.section
                key="clarify-loading"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={stageTransition}
                className="bp-stage flex w-full min-h-0 items-start justify-center py-2 sm:py-3 lg:py-4"
              >
                <ClarifyLoadingPanel
                  idea={idea}
                  message={clarifyLoadingMessages[clarifyLoadingIndex]}
                  stageLabel={getIdeaStageLabel(ideaStage)}
                />
              </motion.section>
            ) : null}

            {phase === "clarify" ? (
              <motion.section
                key="clarify"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={stageTransition}
                className="bp-stage flex w-full min-h-0 items-start justify-center py-1 sm:py-2 lg:py-3"
              >
                <Card className="bp-stage-card relative mx-auto flex w-full max-w-[1040px] flex-col justify-center border-white/10 bg-[linear-gradient(180deg,rgba(20,24,32,0.96),rgba(8,10,14,0.98))]">
                  {finalTransitioning ? <FinalFractureOverlay /> : null}

                  <CardHeader className="bp-stage-header items-center pb-5 text-center">
                    <Badge className="w-fit">Clarify</Badge>
                    <CardTitle className="bp-stage-title text-balance text-[1.72rem] sm:text-[2.05rem]">
                      Now answer these clarification questions.
                    </CardTitle>
                    <CardDescription className="bp-stage-desc max-w-2xl text-balance text-[15px]">
                      One at a time. Each answer sharpens the venture evaluation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="bp-stage-content flex flex-col items-center gap-5">
                    <div className="w-full max-w-[840px] rounded-[22px] border border-white/10 bg-[#0b0f15]/88 px-4 py-3 text-sm leading-6 text-foreground/80">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          Venture Under Test
                        </div>
                        {ideaStage ? (
                          <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/58">
                            {getIdeaStageLabel(ideaStage)}
                          </div>
                        ) : null}
                      </div>
                      <p className="mt-2 break-words">{idea}</p>
                    </div>

                    {advisoryFlags.length ? (
                      <div className="w-full max-w-[840px]">
                        <AdvisoryNotice flags={advisoryFlags} compact />
                      </div>
                    ) : null}

                    <QuestionProgress current={currentQuestionIndex + 1} total={questions.length} />

                    <div className="grid w-full max-w-[860px]">
                      {activeQuestion ? (
                        <motion.div
                          key={currentQuestionIndex}
                          initial={{ opacity: 0, scale: 0.992, y: 10 }}
                          animate={{
                            opacity: leavingQuestion ? 0.94 : 1,
                            scale: leavingQuestion ? 0.996 : 1,
                            y: leavingQuestion ? 6 : 0,
                          }}
                          transition={{ duration: leavingQuestion ? 0.16 : 0.12, ease: [0.22, 1, 0.36, 1] }}
                          className="col-start-1 row-start-1"
                        >
                          <ClarificationCard
                            answer={currentAnswer}
                            answerRef={clarifyTextareaRef}
                            current={currentQuestionIndex + 1}
                            descriptionId={clarifyDescriptionId}
                            errorId={answerFieldInvalid ? errorId : undefined}
                            interactive={!leavingQuestion && !pendingFinalAnalysis}
                            onAnswerChange={setCurrentAnswer}
                            onReset={resetWorkflow}
                            onSubmit={submitCurrentQuestion}
                            question={activeQuestion}
                            questionId={clarifyQuestionId}
                            statusId={clarifyVoiceStatusId}
                            statusSlot={
                              !leavingQuestion && !pendingFinalAnalysis
                                ? renderVoiceStatus("clarify", clarifyVoiceStatusId)
                                : null
                            }
                            textareaId={clarifyFieldId}
                            textareaInvalid={answerFieldInvalid}
                            total={questions.length}
                            voiceControl={!leavingQuestion && !pendingFinalAnalysis ? renderVoiceButton("clarify") : null}
                          />
                        </motion.div>
                      ) : null}

                      {leavingQuestion ? (
                        <div className="col-start-1 row-start-1">
                          <CrumbleQuestion onComplete={handleQuestionCrumbleComplete}>
                            <ClarificationCard
                              answer={leavingQuestion.answer}
                              current={leavingQuestion.index + 1}
                              interactive={false}
                              question={leavingQuestion.question}
                              total={leavingQuestion.total}
                            />
                          </CrumbleQuestion>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </motion.section>
            ) : null}

            {phase === "processing" ? (
              <motion.section
                key="processing"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={stageTransition}
                className="bp-stage flex w-full min-h-0 items-start justify-center py-2 sm:py-3 lg:py-4"
              >
                <Card className="bp-stage-card mx-auto flex w-full max-w-[960px] flex-col justify-center border-white/10 bg-[linear-gradient(180deg,rgba(20,24,32,0.96),rgba(8,10,14,0.98))]">
                  <CardHeader className="items-center pb-4 text-center">
                    <Badge variant="pressure" className="w-fit">
                      Pressure Test
                    </Badge>
                    <CardTitle className="text-balance text-[1.72rem] sm:text-[2.05rem]">
                      The system is pressure testing the venture.
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-[15px]">
                      Clarifications locked. Evaluation in progress.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-5">
                    <div className="w-full max-w-[760px] rounded-[26px] border border-white/10 bg-[#0b0f15]/90 p-5">
                      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Current Pass
                      </div>
                      <motion.div
                        key={processingMessages[processingMessageIndex]}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 text-lg font-medium tracking-[-0.03em] text-foreground"
                      >
                        {processingMessages[processingMessageIndex]}
                      </motion.div>
                      <div className="mt-5 space-y-3">
                        {[0, 1, 2].map((index) => (
                          <div
                            key={index}
                            className="relative h-3 overflow-hidden rounded-full border border-white/8 bg-white/[0.04]"
                          >
                            <motion.div
                              initial={{ scaleX: 0.32, opacity: 0.3 }}
                              animate={{ scaleX: 1, opacity: 0.9 }}
                              transition={{
                                duration: 1.05,
                                repeat: Number.POSITIVE_INFINITY,
                                repeatType: "reverse",
                                delay: index * 0.14,
                              }}
                              className="absolute inset-y-0 left-0 origin-left rounded-full bg-[linear-gradient(90deg,rgba(255,77,79,0.35),rgba(76,141,255,0.24))]"
                              style={{ width: `${88 - index * 16}%` }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid w-full max-w-[760px] gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                      <div className="min-w-0 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          Venture Under Load
                        </div>
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/84">
                          {idea}
                        </p>
                      </div>
                      <div className="min-w-0 rounded-[24px] border border-[#ff4d4f]/18 bg-[#ff4d4f]/[0.08] p-4">
                        <div className="flex items-center gap-2 text-[#ff8082]">
                          <Activity className="h-4 w-4" />
                          <span className="font-mono text-[11px] uppercase tracking-[0.22em]">System posture</span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-foreground/84">
                          The goal is not reassurance. The goal is to see whether this deserves real time, money, or belief.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.section>
            ) : null}

            {isVerdictPhase ? (
              <motion.section
                key="verdict"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={stageTransition}
                className="bp-stage flex w-full min-h-0 items-start justify-center py-2 sm:py-3 lg:py-4"
              >
                <Card className="bp-stage-card mx-auto flex w-full max-w-[1040px] flex-col justify-center border-white/10 bg-[linear-gradient(180deg,rgba(20,24,32,0.96),rgba(8,10,14,0.98))]">
                  <CardHeader className="items-center pb-4 text-center">
                    <Badge variant="pressure" className="w-fit">
                      Verdict
                    </Badge>
                    <CardTitle
                      ref={verdictHeadingRef}
                      tabIndex={-1}
                      className="text-balance text-[1.85rem] leading-[0.98] tracking-[-0.06em] sm:text-[2.3rem] lg:text-[2.55rem] focus:outline-none"
                    >
                      {verdictHeadline}
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-[15px]">
                      The pressure test is complete. Here is the topline read before the full breakdown.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-5">
                    {scoreTone ? (
                      <div className="w-full max-w-[820px] rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,0.24)]">
                        <div className="flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                          <span>Invincibility Score</span>
                          <InfoHint
                            label="Explain the invincibility score"
                            content="Higher is better. The score reflects how believable and resilient the venture looks for its current stage, not whether it already behaves like a late-stage company."
                          />
                        </div>
                        <div className="mt-4 flex flex-wrap items-end justify-center gap-2">
                          <span className={cn("text-[4.1rem] font-semibold leading-none tracking-[-0.12em] sm:text-[5.25rem] lg:text-[5.75rem]", scoreTone.text)}>
                            {breakdown.invincibility_score}
                          </span>
                          <span className="pb-4 text-sm text-foreground/58">/ 100</span>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                          <div
                            className={cn(
                              "inline-flex rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em]",
                              scoreTone.ring,
                            )}
                          >
                            {scoreTone.label}
                          </div>
                          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/68">
                            {breakdown.verdict}
                          </div>
                        </div>
                        <div className="mx-auto mt-5 h-3 max-w-[520px] overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className={cn("h-full rounded-full bg-gradient-to-r", scoreTone.bar)}
                            style={{ width: `${Math.max(8, breakdown.invincibility_score)}%` }}
                          />
                        </div>
                        <p className="mx-auto mt-4 max-w-[540px] text-sm leading-7 text-foreground/78">
                          {scoreTone.helper}. Higher is better, and this is the fastest read on whether the venture deserves more commitment at this stage.
                        </p>
                      </div>
                    ) : null}

                    <div className="w-full max-w-[820px] rounded-[28px] border border-[#ff4d4f]/18 bg-[#ff4d4f]/[0.08] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
                      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-[#ff9a9c]">
                        <span>Core Break Point</span>
                        <InfoHint
                          align="left"
                          label="Explain the core break point"
                          content="This is the single weakness most likely to collapse the venture if it stays unresolved. It is the one thing to test or fix first."
                        />
                      </div>
                      <p className="mt-3 break-words text-[0.98rem] leading-7 text-foreground/88">
                        {breakdown.core_break_point}
                      </p>
                    </div>

                    <div className="flex w-full max-w-[820px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
                      <Button
                        size="lg"
                        onClick={() => {
                          playSound("tap");
                          setPhase("analysis");
                        }}
                        className="w-full whitespace-normal sm:w-auto"
                      >
                        Show me the breakdown
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button variant="secondary" onClick={resetWorkflow} className="w-full whitespace-normal sm:w-auto">
                        Run another venture through BreakPoint
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.section>
            ) : null}

            {isAnalysisPhase ? (
              <motion.section
                key="analysis"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={stageTransition}
                className="bp-stage w-full"
              >
                <Card className="bp-stage-card flex flex-col overflow-visible border-white/10 bg-[linear-gradient(180deg,rgba(20,24,32,0.96),rgba(8,10,14,0.98))]">
                  <CardHeader className="bp-stage-header shrink-0 pb-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0 font-mono text-[11px] uppercase tracking-[0.3em] text-foreground/46">
                        BreakPoint evaluation memo
                      </div>
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                        <Button variant="secondary" onClick={() => void copyBreakdown()} className="w-full whitespace-normal sm:w-auto">
                          {copyState === "copied" ? "Memo Copied" : "Copy Evaluation Memo"}
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="secondary" onClick={resetWorkflow} className="w-full whitespace-normal sm:w-auto">
                          Run another venture through BreakPoint
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="bp-stage-content flex flex-col gap-8 overflow-visible">
                    <div className="space-y-6">
                      <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(7,9,13,0.96))] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.28)] sm:p-7">
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="pressure" className="w-fit">
                                Verdict
                              </Badge>
                              <div className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/56">
                                Outcome before commitment
                              </div>
                            </div>
                            <CardTitle
                              ref={analysisHeadingRef}
                              tabIndex={-1}
                              className="mt-5 max-w-4xl text-balance text-[2.15rem] leading-[0.95] tracking-[-0.065em] text-foreground focus:outline-none sm:text-[2.75rem] lg:text-[3.35rem]"
                            >
                              {verdictHeadline}
                            </CardTitle>
                            <div className="mt-6 max-w-4xl space-y-2">
                              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-[#ff9a9c]">
                                <span>Core Break Point</span>
                                <InfoHint
                                  align="left"
                                  label="Explain the core break point"
                                  content="This is the single weakness most likely to break the venture first. If you only resolve one thing before moving forward, resolve this."
                                />
                              </div>
                              <p className="break-words text-[1.04rem] leading-8 text-foreground/88">
                                {breakdown.core_break_point}
                              </p>
                            </div>
                            <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.035] px-4 py-3 text-sm leading-7 text-foreground/78">
                              {decisionGuidance}
                            </div>
                          </div>

                          {scoreTone ? (
                            <div className="min-w-0 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
                              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                                <span>Invincibility Score</span>
                                <InfoHint
                                  align="left"
                                  label="Explain the invincibility score"
                                  content="Higher is better. The score reflects how resilient the venture looks for its stage and current proof, not whether it has already become a mature company."
                                />
                              </div>
                              <div className="mt-4 flex items-end gap-2">
                                <span className={cn("text-[4.7rem] font-semibold leading-none tracking-[-0.11em]", scoreTone.text)}>
                                  {breakdown.invincibility_score}
                                </span>
                                <span className="pb-3 text-sm text-foreground/58">/ 100</span>
                              </div>
                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <div
                                  className={cn(
                                    "inline-flex rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em]",
                                    scoreTone.ring,
                                  )}
                                >
                                  {scoreTone.label}
                                </div>
                                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/68">
                                  {breakdown.verdict}
                                </div>
                              </div>
                              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                  className={cn("h-full rounded-full bg-gradient-to-r", scoreTone.bar)}
                                  style={{ width: `${Math.max(8, breakdown.invincibility_score)}%` }}
                                />
                              </div>
                              <p className="mt-4 text-sm leading-7 text-foreground/78">
                                {scoreTone.helper}. Higher is better, and the label tells you how much conviction this currently deserves at this stage.
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                        <div className="min-w-0 rounded-[28px] border border-white/10 bg-[#0b0f15]/90 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
                          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                            The gist of the venture
                          </div>
                          <p className="mt-4 break-words text-[15px] leading-8 text-foreground/88">
                            {breakdown.venture_summary}
                          </p>
                        </div>

                        <div className="min-w-0 rounded-[28px] border border-[#ffa940]/18 bg-[#ffa940]/[0.07] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
                          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#ffcc94]">
                            <span>Proof required before launch</span>
                            <InfoHint
                              align="left"
                              label="Explain proof required before launch"
                              content="This is the minimum evidence the venture needs before it deserves deeper commitment. It should answer what would make the idea more believable, not just what sounds impressive."
                            />
                          </div>
                          <p className="mt-3 text-sm leading-7 text-foreground/84">
                            {proofSummary}
                          </p>
                          <ul className="mt-4 space-y-2.5 text-sm leading-7 text-foreground/88">
                            {breakdown.proof_required_before_launch.slice(0, 3).map((item, index) => (
                              <li key={item} className="flex items-start gap-3">
                                <span className="mt-1.5 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[#ffa940] text-[10px] font-mono text-black">
                                  {index + 1}
                                </span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {advisoryFlags.length ? <AdvisoryNotice flags={advisoryFlags} compact /> : null}
                    </div>

                    <div className="pt-4 sm:pt-6">
                      <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
                        {analysisSections.map((section) => (
                          <div key={section.key}>
                            <AnalysisCard
                              title={section.title}
                              items={breakdown[section.key]}
                              icon={section.icon}
                              tone={section.tone}
                              summary={
                                section.key === "proof_required_before_launch" ? proofSummary : section.summary
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] px-4 py-4 md:flex md:items-center md:justify-between md:gap-4">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                          Run another venture through BreakPoint
                        </div>
                        <p className="mt-1 text-sm leading-7 text-foreground/74">
                          Reset the page and pressure test another startup idea, business model, or thesis.
                        </p>
                      </div>
                      <div className="mt-3 md:mt-0 md:shrink-0">
                        <Button size="lg" onClick={resetWorkflow} className="w-full whitespace-normal md:w-auto">
                          Run another venture through BreakPoint
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {copyState === "failed" ? (
                      <div className="shrink-0 rounded-[20px] border border-[#ff4d4f]/20 bg-[#ff4d4f]/[0.08] p-3 text-sm text-foreground">
                        Clipboard access failed. Try again from a secure browser context after deployment.
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </motion.section>
            ) : null}
          </AnimatePresence>
        </motion.main>
      </div>
    </div>
  );
}
