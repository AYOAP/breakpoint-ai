import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, onInput, value, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

    const syncHeight = React.useCallback(() => {
      const node = innerRef.current;

      if (!node) {
        return;
      }

      node.style.height = "0px";
      node.style.height = `${node.scrollHeight}px`;
    }, []);

  React.useEffect(() => {
    syncHeight();
  }, [syncHeight, value]);

  React.useEffect(() => {
    const node = innerRef.current;

    if (!node) {
      return;
    }

    const handleResize = () => {
      syncHeight();
    };

    window.addEventListener("resize", handleResize);

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        syncHeight();
      });

      observer.observe(node);

      return () => {
        window.removeEventListener("resize", handleResize);
        observer.disconnect();
      };
    }

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [syncHeight]);

    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full resize-none overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(8,10,14,0.96))] px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-muted-foreground/75 transition-colors focus-visible:border-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={(node) => {
          innerRef.current = node;

          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        value={value}
        onInput={(event) => {
          syncHeight();
          onInput?.(event);
        }}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
