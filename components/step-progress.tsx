import { cn } from "@/lib/utils";

const steps = [
  { index: 1, label: "Submit" },
  { index: 2, label: "Clarify" },
  { index: 3, label: "Pressure Test" },
  { index: 4, label: "Verdict" },
  { index: 5, label: "Breakdown" },
];

interface StepProgressProps {
  currentStep: number;
}

export function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <ol className="bp-step-progress mx-auto flex w-full flex-wrap items-center justify-center gap-2 pb-1" aria-label="Workflow progress">
        {steps.map((step) => {
          const status = step.index < currentStep ? "complete" : step.index === currentStep ? "active" : "pending";

          return (
            <li
              key={step.label}
              aria-current={status === "active" ? "step" : undefined}
              className={cn(
                "bp-step-card inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-center font-mono text-[11px] uppercase tracking-[0.2em] transition-all duration-300",
                status === "active" &&
                  "border-[#4c8dff]/30 bg-[#4c8dff]/10 text-[#a9c5ff] shadow-[0_0_0_1px_rgba(76,141,255,0.14),0_12px_28px_rgba(10,16,28,0.34)]",
                status === "complete" && "border-white/10 bg-white/[0.05] text-foreground/78",
                status === "pending" && "border-white/8 bg-white/[0.025] text-foreground/54",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  status === "active" && "bg-[#4c8dff]",
                  status === "complete" && "bg-white/60",
                  status === "pending" && "bg-white/18",
                )}
              />
              <span className="whitespace-normal leading-tight">{step.label}</span>
              <span className="sr-only">
                {status === "complete" ? "Completed" : status === "active" ? "Current step" : "Upcoming step"}
              </span>
            </li>
          );
        })}
    </ol>
  );
}
