import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px]",
    "text-[13.5px] font-medium transition-all duration-150 active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AC723E] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary CTA — Accent fill (#AC723E), crisp white text.
        primary: "bg-[#AC723E] text-white hover:bg-[#966032] shadow-[0_1px_3px_rgba(12,9,4,0.12)] font-semibold",
        // Secondary — Sleek dark slate (#0C0904) button variant.
        secondary: "bg-[#0C0904] text-white hover:bg-[#231E17] border border-[#0C0904] shadow-sm",
        // Outline — Crisp hairline border on raised surface.
        outline: "border border-[#DBC3B3] bg-[#FAF7F3] text-[#0C0904] hover:bg-[#ECE3D8] hover:border-[#AA8D74]",
        // Ghost — Unfilled low-emphasis actions.
        ghost: "bg-transparent text-[#0C0904] hover:bg-[#DBC3B3]/20",
        // Link — Accent text.
        link: "text-[#AC723E] underline-offset-4 hover:underline p-0 h-auto",
        // Destructive — Warning red.
        destructive: "bg-[#A6432F] text-white hover:bg-[#8A3624]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-[12.5px]",
        lg: "h-10 px-5 text-[14.5px]",
        icon: "h-9 w-9 shrink-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
