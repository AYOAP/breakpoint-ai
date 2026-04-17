import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.24em] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-sm",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/[0.05] text-foreground/82",
        danger: "border-[#ff4d4f]/30 bg-[#ff4d4f]/10 text-[#ff4d4f]",
        warning: "border-[#ffa940]/30 bg-[#ffa940]/10 text-[#ffa940]",
        pressure: "border-[#4c8dff]/30 bg-[#4c8dff]/10 text-[#4c8dff]",
        success: "border-[#2ecc71]/30 bg-[#2ecc71]/10 text-[#2ecc71]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
