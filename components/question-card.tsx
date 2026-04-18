import { ArrowUpRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface QuestionCardProps {
  index: number;
  question: string;
  value: string;
  onChange: (value: string) => void;
}

export function QuestionCard({ index, question, value, onChange }: QuestionCardProps) {
  return (
    <Card className="flex h-full flex-col border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(10,13,18,0.96))]">
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Assumption {String(index + 1).padStart(2, "0")}
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <CardTitle className="break-words text-base leading-7">{question}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Answer directly. Precision matters."
          rows={4}
          className="h-full min-h-[104px] flex-1 border-white/8 bg-[#0b0f15]/90 lg:min-h-[88px]"
        />
      </CardContent>
    </Card>
  );
}
