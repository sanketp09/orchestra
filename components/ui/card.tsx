import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card — "Document Insert" aesthetic.
 *
 * Design language:
 * - Sharp top-left/top-right corners (no radius at top) → feels like a filed document
 * - Rounded bottom corners only → sits naturally on a surface
 * - Top border is 2px solid, colored by context (default = charcoal ink tint)
 * - Inner shadow on top edge (inset) → recessed, physical depth
 * - No generic drop shadow — just the inset + a very faint ambient
 * - Hover: top border shifts to warm amber accent, inset deepens slightly
 */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Shape — sharp top, rounded bottom
        "rounded-b-[10px] rounded-t-[2px]",
        // Surface
        "bg-[#FAF7F3] text-[#1C1917]",
        // Border — top is 2px, sides+bottom 1px
        "border border-[#D8CCB8] border-t-[2px] border-t-[#1C1917]/20",
        // Inset shadow on top = physical document-in-tray effect
        "shadow-[inset_0_2px_4px_rgba(28,25,23,0.05),_0_1px_3px_rgba(28,25,23,0.04)]",
        // Transition
        "transition-all duration-200",
        // Hover — amber top rule, deeper inset
        "hover:border-t-[#AC723E] hover:shadow-[inset_0_2px_6px_rgba(28,25,23,0.07),_0_4px_16px_rgba(28,25,23,0.08)]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref}
      className={cn("text-[17px] font-semibold text-[#1C1917] tracking-tight leading-snug", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref}
      className={cn("text-[14px] text-[#7A5C48] leading-relaxed", className)}
      {...props}
    />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-3 p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
