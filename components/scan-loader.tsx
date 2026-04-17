"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radar, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const statusMessages = [
  "Scanning hidden dependencies",
  "Pressurizing weak assumptions",
  "Mapping likely failure paths",
  "Locating threshold breakpoints",
];

interface ScanLoaderProps {
  idea: string;
  answersCount: number;
}

export function ScanLoader({ idea, answersCount }: ScanLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % statusMessages.length);
    }, 1500);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <Card className="flex h-full flex-col overflow-hidden border-[#4c8dff]/15 bg-[linear-gradient(180deg,rgba(76,141,255,0.08),rgba(10,13,18,0.97))]">
      <CardHeader className="pb-3">
        <Badge variant="pressure" className="w-fit">
          Step 3
        </Badge>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-2xl md:text-[2rem]">Apply Pressure</CardTitle>
            <CardDescription className="max-w-2xl text-sm md:text-base">
              The system is stress testing the idea against the assumptions you just exposed.
            </CardDescription>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Input quality</div>
            <div className="mt-1 text-sm text-foreground">{answersCount} assumptions clarified</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex items-center gap-4 rounded-[24px] border border-white/10 bg-[#0b0f15]/90 px-4 py-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.03]">
            <Radar className="h-5 w-5 animate-pulse text-[#4c8dff]" />
          </div>
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Current pass</div>
            <motion.div
              key={statusMessages[messageIndex]}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-1 text-lg font-medium tracking-[-0.02em] text-foreground"
            >
              {statusMessages[messageIndex]}
            </motion.div>
          </div>
        </div>

        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="relative h-10 overflow-hidden rounded-[18px] border border-white/10 bg-[#0b0f15]"
            >
              <div className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] animate-shimmer" />
              <motion.div
                initial={{ scaleX: 0.4, opacity: 0.2 }}
                animate={{ scaleX: 1, opacity: 0.8 }}
                transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse", delay: index * 0.15 }}
                className="absolute inset-y-0 left-0 origin-left rounded-full bg-[linear-gradient(90deg,rgba(76,141,255,0.24),rgba(255,77,79,0.18))]"
                style={{ width: `${82 - index * 11}%` }}
              />
            </div>
          ))}
        </div>

        <div className="grid flex-1 gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Submission under load</div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/85">{idea}</p>
          </div>
          <div className="rounded-[24px] border border-[#ff4d4f]/15 bg-[#ff4d4f]/[0.07] p-4">
            <div className="flex items-center gap-2 text-[#ff4d4f]">
              <ShieldAlert className="h-4 w-4" />
              <span className="font-mono text-[11px] uppercase tracking-[0.22em]">System posture</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-foreground/85">
              This pass looks for weakness first. Supportive framing is intentionally suppressed.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
