"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleHelp } from "lucide-react";

import { cn } from "@/lib/utils";

interface InfoHintProps {
  align?: "left" | "right";
  className?: string;
  content: string;
  label: string;
}

export function InfoHint({ align = "right", className, content, label }: InfoHintProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={cn("relative inline-flex shrink-0", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? tooltipId : undefined}
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-foreground/66 transition-colors duration-200 hover:border-white/18 hover:text-foreground/88 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4c8dff]/55 sm:h-8 sm:w-8"
        onClick={() => setOpen((current) => !current)}
      >
        <CircleHelp className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.span
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            id={tooltipId}
            role="tooltip"
            className={cn(
              "absolute top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-[18px] border border-white/10 bg-[#0b0f15]/96 px-3 py-3 text-left text-[13px] leading-6 text-foreground/88 shadow-[0_20px_55px_rgba(0,0,0,0.3)] backdrop-blur-sm",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {content}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
