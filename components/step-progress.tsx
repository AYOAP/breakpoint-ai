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
    <div className="bp-step-progress mb-3 shrink-0 overflow-x-auto pb-1">
      <div className="mx-auto flex min-w-max items-center justify-center gap-2 lg:min-w-0">
        {steps.map((step) => {
          const status = step.index < currentStep ? "complete" : step.index === currentStep ? "active" : "pending";

          return (
            <div
              key={step.label}
              className={cn(
                "bp-step-card inline-flex items-center gap-2 rounded-full border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.22em] transition-all duration-300",
                status === "active" &&
                  "border-[#4c8dff]/30 bg-[#4c8dff]/10 text-[#a9c5ff] shadow-[0_0_0_1px_rgba(76,141,255,0.14),0_12px_28px_rgba(10,16,28,0.34)]",
                status === "complete" && "border-white/10 bg-white/[0.05] text-foreground/78",
                status === "pending" && "border-white/8 bg-white/[0.025] text-foreground/46",
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
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
