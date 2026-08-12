import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Input — muted border, background fill, accent border on focus.
 * No focus ring glow, no shadow — the border color change alone carries
 * the focus state, consistent with the product's quiet elevation model.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-input border border-muted bg-background px-3 py-2",
          "text-body text-foreground placeholder:text-muted-foreground",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:border-accent",
          "disabled:cursor-not-allowed disabled:opacity-40",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
