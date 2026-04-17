"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  type LucideIcon,
} from "lucide-react";

import { AnalysisCard } from "@/components/analysis-card";
import { CursorTrail } from "@/components/cursor-trail";
import { StepProgress } from "@/components/step-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn, detectAdvisoryFlags, formatBreakdownForCopy, type AdvisoryFlag } from "@/lib/utils";
import type {
  AnalysisBreakdown,
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
  body: Record<string, unknown>,
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

function getScoreTone(score: number) {
  if (score >= 85) {
    return {
      helper: "Founder ready / investor ready",
      label: "Strong",
      ring: "border-[#2ecc71]/24 bg-[#2ecc71]/10 text-[#8be4b2]",
      text: "text-[#8be4b2]",
      bar: "from-[#2ecc71] to-[#7ce7a8]",
    };
  }

  if (score >= 70) {
    return {
      helper: "Worth a real-world test",
      label: "Resilient",
      ring: "border-[#4c8dff]/24 bg-[#4c8dff]/10 text-[#9fc0ff]",
      text: "text-[#9fc0ff]",
      bar: "from-[#4c8dff] to-[#7fb0ff]",
    };
  }

  if (score >= 40) {
    return {
      helper: "Needs sharper proof",
      label: "Questionable",
      ring: "border-[#ffa940]/24 bg-[#ffa940]/10 text-[#ffcc94]",
      text: "text-[#ffcc94]",
      bar: "from-[#ffa940] to-[#ffd28d]",
    };
  }

  return {
    helper: "Do not commit yet",
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

function buildDecisionGuidance(score: number) {
  if (score >= 85) {
    return "Even strong concepts should not absorb real capital until at least two proof conditions are met in the market.";
  }

  if (score >= 70) {
    return "Do not scale this until at least two proof conditions are met with real users, not founder intuition.";
  }

  if (score >= 40) {
    return "Do not commit time or capital until at least two proof conditions are met and the weakest assumption survives contact with users.";
  }

  return "Do not commit time or capital until at least two proof conditions are met and the core break point stops showing up in live tests.";
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
    <div className="flex flex-col items-center gap-3">
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
  interactive = true,
  onAnswerChange,
  onReset,
  onSubmit,
  question,
  statusSlot,
  total,
  voiceControl,
}: {
  answer: string;
  answerRef?: React.Ref<HTMLTextAreaElement>;
  current: number;
  interactive?: boolean;
  onAnswerChange?: (value: string) => void;
  onReset?: () => void;
  onSubmit?: () => void;
  question: string;
  statusSlot?: React.ReactNode;
  total: number;
  voiceControl?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-white/12 bg-[#0b0f15]/98 shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="pressure" className="w-fit">
            Question {current} of {total}
          </Badge>
          <div className="flex items-center gap-3">
            {voiceControl}
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Pressure Point
            </div>
          </div>
        </div>
        <CardTitle className="pr-2 text-[1.05rem] leading-[1.22] text-foreground [overflow-wrap:anywhere] sm:text-[1.26rem] lg:text-[1.4rem]">
          {question}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          ref={answerRef}
          value={answer}
          onChange={(event) => onAnswerChange?.(event.target.value)}
          placeholder="Answer directly. No filler."
          disabled={!interactive}
          className={cn(
            "min-h-[126px] border-white/8 bg-white/[0.02] text-[15px] leading-7",
            !interactive && "pointer-events-none opacity-80",
          )}
        />
        {statusSlot ? <div className="mt-3">{statusSlot}</div> : null}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm leading-6 text-foreground/74">
            {interactive
              ? "This answer changes the final evaluation memo."
              : "The next prompt is moving into place."}
          </div>
          {interactive ? (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onReset}>
                Start Over
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button size="lg" onClick={onSubmit}>
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

  const ideaTextareaRef = useRef<HTMLTextAreaElement>(null);
  const stageNoteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const clarifyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const pendingNextQuestionRef = useRef<number | null>(null);
  const queuedVoiceTargetRef = useRef<VoiceTarget | null>(null);
  const voiceTargetRef = useRef<VoiceTarget | null>(null);

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
  const scoreTone = breakdown ? getScoreTone(breakdown.invincibility_score) : null;
  const verdictHeadline = breakdown ? formatVerdictHeadline(breakdown.verdict) : "";
  const decisionGuidance = breakdown ? buildDecisionGuidance(breakdown.invincibility_score) : "";

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
    });
  }, [phase]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
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
  }, [idea, ideaStage, pendingAction, phase, stageNote]);

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
          const payload = await fetchAnalysisBreakdown(idea, finalAnswers.answers);
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
  }, [idea, pendingFinalAnalysis, phase, questions.length]);

  function moveToCalibration() {
    const nextIdea = idea.trim();

    if (nextIdea.length < 20) {
      setError("What are you thinking of building? Give the system enough venture detail to pressure.");
      return;
    }

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

  async function fetchAnalysisBreakdown(sourceIdea: string, sourceAnswers: ClarificationPair[]) {
    const nextIdea = sourceIdea.trim();
    const normalizedAnswers = sourceAnswers.map((entry) => ({
      question: entry.question,
      answer: entry.answer.trim(),
    }));

    if (normalizedAnswers.some((entry) => entry.answer.length < 3)) {
      throw new Error("Answer each clarification before applying pressure.");
    }

    const payload = await postApiJson<AnalysisBreakdown & { error?: string }>(
      "/api/analyze",
      {
        idea: nextIdea,
        answers: normalizedAnswers,
      },
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
      >
        {active ? "Stop Voice" : "Voice Input"}
        {active ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
    );
  }

  function renderVoiceStatus(target: VoiceTarget) {
    if (voiceTarget !== target) {
      return null;
    }

    return (
      <div className="space-y-3">
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
    <div className="relative min-h-[100svh] overflow-x-hidden">
      <CursorTrail />
      <div className="absolute inset-0 bg-grid bg-[size:48px_48px] opacity-[0.035]" />
      <div className="absolute left-[-8rem] top-[-8rem] h-80 w-80 rounded-full bg-[#ff4d4f]/12 blur-3xl" />
      <div className="absolute right-[-8rem] top-10 h-72 w-72 rounded-full bg-[#4c8dff]/12 blur-3xl" />
      <div className="absolute bottom-[-10rem] left-1/3 h-80 w-80 rounded-full bg-[#ffa940]/10 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent)] opacity-70" />

      <div
        className={cn(
          "bp-shell relative mx-auto flex min-h-[100svh] w-full max-w-[1660px] flex-col px-4 py-3 sm:px-5 lg:px-6",
          isAnalysisPhase ? "bp-shell--analysis" : "",
          allowsStageScroll ? "bp-shell--scroll h-auto min-h-[100svh]" : "",
        )}
      >
        <header className="bp-hero relative mb-3 shrink-0 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,20,28,0.92),rgba(9,12,18,0.96))] px-4 py-4 shadow-[0_32px_90px_rgba(0,0,0,0.42)] lg:px-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,77,79,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(76,141,255,0.12),transparent_30%)]" />
          <div className="bp-hero-card relative flex items-center gap-4 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-4 sm:p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-[#ff4d4f]/24 bg-[#ff4d4f]/12 text-[#ff7b7d] shadow-[0_0_40px_rgba(255,77,79,0.14)]">
              <Crosshair className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.34em] text-foreground/55">BREAKPOINT AI</div>
              <p className="bp-hero-copy mt-1 text-sm leading-6 text-muted-foreground">
                Pressure test the venture before the market does.
              </p>
            </div>
          </div>
        </header>

        <StepProgress currentStep={currentStep} />

        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 shrink-0 rounded-[22px] border border-[#ff4d4f]/20 bg-[#ff4d4f]/10 px-4 py-3 text-sm text-foreground"
          >
            {error}
          </motion.div>
        ) : null}

        <motion.main
          className={cn(
            "bp-main min-h-[520px]",
            allowsStageScroll
              ? "bp-main--scroll block overflow-visible"
              : "flex flex-1 overflow-visible lg:min-h-0",
            isAnalysisPhase ? "bp-main--analysis" : "",
          )}
          initial={false}
        >
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
                <Card className="bp-stage-card mx-auto flex w-full max-w-[980px] flex-col justify-center border-white/10 bg-[linear-gradient(180deg,rgba(20,24,32,0.96),rgba(8,10,14,0.98))]">
                  <CardHeader className="bp-stage-header items-center pb-4 text-center">
                    <Badge className="w-fit">Venture Intake</Badge>
                    <CardTitle className="bp-stage-title text-balance text-[2rem] sm:text-[2.35rem]">
                      What are you thinking of building?
                    </CardTitle>
                    <CardDescription className="bp-stage-desc max-w-2xl text-balance text-[15px]">
                      Give the system a startup idea, business model, or investment thesis. The clearer the mechanics, the sharper the breakpoints.
                    </CardDescription>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
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
                    <div className="bp-intake-panel relative w-full max-w-[820px] rounded-[28px] border border-white/10 bg-[#0b0f15]/94 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
                      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,77,79,0.65),transparent)]" />
                      <div className="absolute right-0 top-0 h-36 w-36 bg-[radial-gradient(circle,rgba(255,77,79,0.12),transparent_72%)]" />
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          Intake Channel
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={isListening && voiceTarget === "idea" ? "danger" : "secondary"}
                          onClick={() => toggleVoiceCapture("idea")}
                          disabled={!speechSupported}
                        >
                          {isListening && voiceTarget === "idea" ? "Stop Voice" : "Voice Input"}
                          {isListening && voiceTarget === "idea" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Textarea
                        ref={ideaTextareaRef}
                        value={idea}
                        onChange={(event) => setIdea(event.target.value)}
                        placeholder="Describe the venture, who pays, why they switch, how it reaches the market, and what has to be true."
                        className="bp-idea-textarea mt-4 min-h-[220px] border-white/8 bg-white/[0.02] text-[15px] leading-7"
                      />

                      <div className="mt-3">{renderVoiceStatus("idea")}</div>
                    </div>

                    {advisoryFlags.length ? (
                      <div className="w-full max-w-[820px]">
                        <AdvisoryNotice flags={advisoryFlags} />
                      </div>
                    ) : null}

                    <div className="flex w-full max-w-[820px] flex-wrap items-center justify-center gap-2.5">
                      {sampleIdeas.map((sample) => (
                        <button
                          key={sample.label}
                          type="button"
                          onClick={() => {
                            setIdea(sample.idea);
                            setError(null);
                            window.setTimeout(() => {
                              ideaTextareaRef.current?.focus();
                            }, 40);
                          }}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-foreground/78 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.06]"
                        >
                          {sample.label}
                        </button>
                      ))}
                    </div>

                    <div className="bp-utility-row flex w-full max-w-[820px] items-center justify-center">
                      <Button size="lg" onClick={moveToCalibration}>
                        Calibrate Pressure Test
                        <ArrowRight className="h-4 w-4" />
                      </Button>
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
                    <CardTitle className="bp-stage-title text-balance text-[1.95rem] sm:text-[2.2rem]">
                      How developed is this idea right now?
                    </CardTitle>
                    <CardDescription className="bp-stage-desc max-w-2xl text-balance text-[15px]">
                      This helps BreakPoint match the pressure test to your stage instead of assuming the venture is fully built.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="bp-stage-content flex flex-col items-center gap-5">
                    <div className="w-full max-w-[940px] rounded-[24px] border border-white/10 bg-[#0b0f15]/88 px-4 py-4 text-sm leading-6 text-foreground/80">
                      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Venture Under Test
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-foreground/84">{idea}</p>
                    </div>

                    <div className="grid w-full max-w-[940px] gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {ideaStages.map((stage) => {
                        const selected = ideaStage === stage.value;

                        return (
                          <button
                            key={stage.value}
                            type="button"
                            onClick={() => {
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
                              <div className="font-medium tracking-[-0.025em] text-foreground">{stage.label}</div>
                              <div
                                className={cn(
                                  "h-2.5 w-2.5 rounded-full transition-colors",
                                  selected ? "bg-[#4c8dff]" : "bg-white/20",
                                )}
                              />
                            </div>
                            <p className="mt-3 text-sm leading-6 text-foreground/68">{stage.hint}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="w-full max-w-[940px] rounded-[26px] border border-white/10 bg-[#0b0f15]/92 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          Anything else the system should know before applying pressure?
                        </div>
                        {renderVoiceButton("stage_note")}
                      </div>
                      <Textarea
                        ref={stageNoteTextareaRef}
                        value={stageNote}
                        onChange={(event) => setStageNote(event.target.value.slice(0, 240))}
                        placeholder="Optional context: market, audience, current traction, constraints, or what still feels unclear."
                        className="mt-3 min-h-[88px] border-white/8 bg-white/[0.02] text-[14px] leading-6"
                      />
                      <div className="mt-3">{renderVoiceStatus("stage_note")}</div>
                      <div className="mt-2 flex items-center justify-between text-xs text-foreground/48">
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
                      <Button variant="secondary" onClick={() => setPhase("define")}>
                        Back to idea
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="lg"
                        onClick={() => void requestClarifications(idea, ideaStage, stageNote)}
                        disabled={!ideaStage || pendingAction === "clarify"}
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
                    <CardTitle className="bp-stage-title text-balance text-[1.9rem] sm:text-[2.15rem]">
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
                            interactive={!leavingQuestion && !pendingFinalAnalysis}
                            onAnswerChange={setCurrentAnswer}
                            onReset={resetWorkflow}
                            onSubmit={submitCurrentQuestion}
                            question={activeQuestion}
                            statusSlot={!leavingQuestion && !pendingFinalAnalysis ? renderVoiceStatus("clarify") : null}
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
                    <CardTitle className="text-balance text-[1.85rem] sm:text-[2.15rem]">
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

                    <div className="grid w-full max-w-[760px] gap-4 md:grid-cols-[1.35fr_1fr]">
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          Venture Under Load
                        </div>
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/84">
                          {idea}
                        </p>
                      </div>
                      <div className="rounded-[24px] border border-[#ff4d4f]/18 bg-[#ff4d4f]/[0.08] p-4">
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
                    <CardTitle className="text-balance text-[2rem] leading-[0.98] tracking-[-0.06em] sm:text-[2.55rem]">
                      {verdictHeadline}
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-[15px]">
                      The pressure test is complete. Here is the topline read before the full breakdown.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-5">
                    {scoreTone ? (
                      <div className="w-full max-w-[820px] rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,0.24)]">
                        <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                          Invincibility Score
                        </div>
                        <div className="mt-4 flex items-end justify-center gap-2">
                          <span className={cn("text-[5rem] font-semibold leading-none tracking-[-0.12em] sm:text-[5.75rem]", scoreTone.text)}>
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
                          {scoreTone.helper}. Higher is better, and this is the fastest read on whether the venture deserves more commitment.
                        </p>
                      </div>
                    ) : null}

                    <div className="w-full max-w-[820px] rounded-[28px] border border-[#ff4d4f]/18 bg-[#ff4d4f]/[0.08] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
                      <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#ff9a9c]">
                        Core Break Point
                      </div>
                      <p className="mt-3 break-words text-[0.98rem] leading-7 text-foreground/88">
                        {breakdown.core_break_point}
                      </p>
                    </div>

                    <div className="flex w-full max-w-[820px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
                      <Button size="lg" onClick={() => setPhase("analysis")}>
                        Show me the breakdown
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button variant="secondary" onClick={resetWorkflow}>
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-foreground/46">
                        BreakPoint evaluation memo
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button variant="secondary" onClick={() => void copyBreakdown()}>
                          {copyState === "copied" ? "Memo Copied" : "Copy Evaluation Memo"}
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="secondary" onClick={resetWorkflow}>
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
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="pressure" className="w-fit">
                                Verdict
                              </Badge>
                              <div className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/56">
                                Outcome before commitment
                              </div>
                            </div>
                            <CardTitle className="mt-5 max-w-4xl text-balance text-[2.7rem] leading-[0.95] tracking-[-0.065em] text-foreground sm:text-[3.35rem]">
                              {verdictHeadline}
                            </CardTitle>
                            <div className="mt-6 max-w-4xl space-y-2">
                              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#ff9a9c]">
                                Core Break Point
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
                            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
                              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                                Invincibility Score
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
                                {scoreTone.helper}. Higher is better, and the label tells you how much conviction this currently deserves.
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="rounded-[28px] border border-white/10 bg-[#0b0f15]/90 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
                          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                            The gist of the venture
                          </div>
                          <p className="mt-4 break-words text-[15px] leading-8 text-foreground/88">
                            {breakdown.venture_summary}
                          </p>
                        </div>

                        <div className="rounded-[28px] border border-[#ffa940]/18 bg-[#ffa940]/[0.07] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
                          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#ffcc94]">
                            Proof required before launch
                          </div>
                          <p className="mt-3 text-sm leading-7 text-foreground/84">
                            This venture needs proof of customer pull, repeat usage, and a repeatable channel before real commitment.
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
                              summary={section.summary}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] px-4 py-4 md:flex md:items-center md:justify-between">
                      <div>
                        <div className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                          Run another venture through BreakPoint
                        </div>
                        <p className="mt-1 text-sm leading-7 text-foreground/74">
                          Reset the page and pressure test another startup idea, business model, or thesis.
                        </p>
                      </div>
                      <div className="mt-3 md:mt-0">
                        <Button size="lg" onClick={resetWorkflow}>
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
