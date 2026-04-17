import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[18px] text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-[1px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-[#ff8b74]/20 bg-[linear-gradient(135deg,#ff5f52,#ff8c4a)] text-white shadow-[0_16px_40px_rgba(255,96,82,0.26)] hover:-translate-y-0.5 hover:brightness-105 active:brightness-95",
        secondary:
          "border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-white/18 hover:bg-white/[0.08] active:bg-white/[0.05]",
        ghost: "text-foreground hover:bg-white/6",
        danger:
          "border border-[#ff7073]/24 bg-[linear-gradient(135deg,#ff4d4f,#ff6d70)] text-white shadow-[0_16px_40px_rgba(255,77,79,0.24)] hover:-translate-y-0.5 hover:brightness-105 active:brightness-95",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-[14px] px-3 text-xs",
        lg: "h-12 px-6 text-sm",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
