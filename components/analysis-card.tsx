import { type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnalysisCardProps {
  title: string;
  items: string[];
  icon: LucideIcon;
  summary?: string;
  tone: "danger" | "warning" | "pressure" | "success";
}

const toneStyles = {
  danger: {
    border: "border-[#ff4d4f]/20",
    icon: "text-[#ff4d4f]",
    dot: "bg-[#ff4d4f]",
    line: "bg-[linear-gradient(90deg,transparent,rgba(255,77,79,0.7),transparent)]",
    wash: "bg-[radial-gradient(circle_at_top,rgba(255,77,79,0.16),transparent_68%)]",
    chip: "border-[#ff4d4f]/20 bg-[#ff4d4f]/10 text-[#ff9a9c]",
  },
  warning: {
    border: "border-[#ffa940]/20",
    icon: "text-[#ffa940]",
    dot: "bg-[#ffa940]",
    line: "bg-[linear-gradient(90deg,transparent,rgba(255,169,64,0.7),transparent)]",
    wash: "bg-[radial-gradient(circle_at_top,rgba(255,169,64,0.14),transparent_68%)]",
    chip: "border-[#ffa940]/20 bg-[#ffa940]/10 text-[#ffcc94]",
  },
  pressure: {
    border: "border-[#4c8dff]/20",
    icon: "text-[#4c8dff]",
    dot: "bg-[#4c8dff]",
    line: "bg-[linear-gradient(90deg,transparent,rgba(76,141,255,0.7),transparent)]",
    wash: "bg-[radial-gradient(circle_at_top,rgba(76,141,255,0.16),transparent_68%)]",
    chip: "border-[#4c8dff]/20 bg-[#4c8dff]/10 text-[#9fc0ff]",
  },
  success: {
    border: "border-[#2ecc71]/20",
    icon: "text-[#2ecc71]",
    dot: "bg-[#2ecc71]",
    line: "bg-[linear-gradient(90deg,transparent,rgba(46,204,113,0.7),transparent)]",
    wash: "bg-[radial-gradient(circle_at_top,rgba(46,204,113,0.15),transparent_68%)]",
    chip: "border-[#2ecc71]/20 bg-[#2ecc71]/10 text-[#8be4b2]",
  },
} as const;

export function AnalysisCard({ title, items, icon: Icon, summary, tone }: AnalysisCardProps) {
  const styles = toneStyles[tone];

  return (
    <Card className={cn("relative overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(10,13,18,0.96))]", styles.border)}>
      <div className={cn("absolute inset-0 opacity-80", styles.wash)} />
      <div className={cn("absolute inset-x-0 top-0 h-px", styles.line)} />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.04]">
              <Icon className={cn("h-5 w-5", styles.icon)} />
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-foreground/48">Evaluation</div>
              <CardTitle className="mt-2 text-[1.05rem]">{title}</CardTitle>
            </div>
          </div>
          <div
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em]",
              styles.chip,
            )}
          >
            {items.length} points
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {summary ? <p className="mb-4 text-sm leading-7 text-foreground/72">{summary}</p> : null}
        <ul className="space-y-2.5 pr-1">
          {items.map((item, index) => (
            <li key={item} className="flex items-start gap-3 text-sm leading-7 text-foreground/90">
              <span
                className={cn(
                  "mt-1.5 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full text-[10px] font-mono text-white/95 shadow-[0_6px_18px_rgba(0,0,0,0.22)]",
                  styles.dot,
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
