"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Badge — Fix 3: Restrained badges with subtle micro-animations.
 * - Verified/positive: small solid dot with gentle scale pulse.
 * - In Review/pending: breathing outline over 2.5s loop.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[11.5px] font-medium tracking-tight transition-all duration-150",
  {
    variants: {
      variant: {
        neutral: "border-[#DBC3B3] bg-[#FAF7F3] text-[#AA8D74]",
        success: "border-[#3A6A4E]/30 bg-[#3A6A4E]/10 text-[#3A6A4E]",
        warning: "border-[#B8873A]/40 bg-[#B8873A]/10 text-[#B8873A] animate-breathe-outline",
        danger: "border-[#A6432F]/30 bg-[#A6432F]/10 text-[#A6432F]",
        info: "border-[#3B6A8A]/30 bg-[#3B6A8A]/10 text-[#3B6A8A]",
        ai: "border-[#6B5A7A]/30 bg-[#6B5A7A]/10 text-[#6B5A7A]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

const dotColor: Record<NonNullable<VariantProps<typeof badgeVariants>["variant"]>, string> = {
  neutral: "bg-[#AA8D74]",
  success: "bg-[#3A6A4E]",
  warning: "bg-[#B8873A]",
  danger: "bg-[#A6432F]",
  info: "bg-[#3B6A8A]",
  ai: "bg-[#6B5A7A]",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Show the leading status dot. Defaults to true. */
  dot?: boolean;
}

function Badge({ className, variant = "neutral", dot = true, children, ...props }: BadgeProps) {
  const v = variant ?? "neutral";
  const isVerified = v === "success";

  return (
    <span className={cn(badgeVariants({ variant: v, className }))} {...props}>
      {dot && (
        <motion.span
          aria-hidden
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor[v])}
          animate={
            isVerified
              ? { scale: [1, 1.15, 1], opacity: [1, 0.7, 1] }
              : undefined
          }
          transition={
            isVerified
              ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
              : undefined
          }
        />
      )}
      <span className="font-medium">{children}</span>
    </span>
  );
}

export { Badge, badgeVariants };
