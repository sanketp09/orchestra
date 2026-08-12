import * as React from "react";
import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";

/* ─────────────────────────────────────────────────────────────────────────
 * GLASSMORPHIC COMPONENT PRIMITIVES
 * For the Neo-Industrial design system
 * ───────────────────────────────────────────────────────────────────────── */

interface GlassProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  hover?: boolean;
  glow?: boolean;
  children: React.ReactNode;
}

/**
 * Base glass panel with backdrop blur and subtle borders
 * elevated={true} adds more blur + shadow for modals/popovers
 * hover={true} adds lift animation on hover
 * glow={true} adds accent glow on hover
 */
export const GlassPanel = React.forwardRef<HTMLDivElement, GlassProps>(
  ({ className, elevated = false, hover = false, glow = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base glass styling
          elevated ? "glass-elevated" : "glass-panel",
          "rounded-xl",
          // Hover effects
          hover && "glass-hover cursor-pointer",
          glow && hover && "accent-glow-hover",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassPanel.displayName = "GlassPanel";



interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  elevated?: boolean;
  hover?: boolean;
  glow?: boolean;
  stagger?: number;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, stagger = 0, hover = true, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.4,
          delay: stagger * 0.06,
          ease: [0.16, 1, 0.3, 1],
        }}
        className={cn(
          "glass-panel rounded-xl",
          hover && "glass-hover cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
GlassCard.displayName = "GlassCard";

/**
 * Floating sidebar with glass effect
 */
export const GlassSidebar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "glass-panel rounded-2xl m-3 p-2",
          "transition-all duration-300 ease-out",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassSidebar.displayName = "GlassSidebar";

/**
 * Glass input with focus glow
 */
export const GlassInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "glass-panel rounded-lg px-4 py-2.5",
          "bg-white/[0.06] text-white placeholder:text-white/40",
          "border border-white/[0.08] focus:border-white/[0.2]",
          "focus:outline-none focus:accent-glow",
          "transition-all duration-150",
          className
        )}
        {...props}
      />
    );
  }
);
GlassInput.displayName = "GlassInput";

/**
 * Glass button with amber gradient
 */
interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = "primary", size = "md", asChild = false, children, ...props }, ref) => {
    const variants = {
      primary: "bg-gradient-to-r from-[#F5A623] to-[#E8862B] text-black font-semibold hover:shadow-[0_0_24px_rgba(245,166,35,0.4)] hover:scale-105",
      secondary: "glass-panel text-white hover:glass-elevated hover:border-white/20",
      ghost: "text-white/80 hover:text-white hover:bg-white/[0.04]",
    };
    
    const sizes = {
      sm: "px-3 py-1.5 text-sm rounded-lg",
      md: "px-4 py-2.5 text-sm rounded-xl",
      lg: "px-6 py-3 text-base rounded-xl",
    };

    if (asChild) {
      return (
        <div
          className={cn(
            "transition-all duration-150 ease-out",
            "focus:outline-none focus:ring-2 focus:ring-[#F5A623]/50",
            variants[variant],
            sizes[size],
            className
          )}
        >
          {children}
        </div>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(
          "transition-all duration-150 ease-out",
          "focus:outline-none focus:ring-2 focus:ring-[#F5A623]/50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
GlassButton.displayName = "GlassButton";

/**
 * Status pill with glass effect
 */
interface StatusPillProps extends React.HTMLAttributes<HTMLDivElement> {
  status: "success" | "warning" | "danger" | "info" | "ai";
  icon?: React.ReactNode;
}

export const StatusPill = React.forwardRef<HTMLDivElement, StatusPillProps>(
  ({ className, status, icon, children, ...props }, ref) => {
    const statusStyles = {
      success: "bg-[#34D399]/20 border-[#34D399]/30 text-[#34D399]",
      warning: "bg-[#FBBF24]/20 border-[#FBBF24]/30 text-[#FBBF24]",
      danger: "bg-[#F87171]/20 border-[#F87171]/30 text-[#F87171]",
      info: "bg-[#60A5FA]/20 border-[#60A5FA]/30 text-[#60A5FA]",
      ai: "bg-[#A78BFA]/20 border-[#A78BFA]/30 text-[#A78BFA]",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "glass-panel rounded-full px-3 py-1.5 text-xs font-semibold",
          "flex items-center gap-1.5",
          statusStyles[status],
          className
        )}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </div>
    );
  }
);
StatusPill.displayName = "StatusPill";

/**
 * Progress bar with animated gradient fill
 */
interface GlassProgressProps {
  value: number; // 0-100
  className?: string;
  animated?: boolean;
}

export const GlassProgress: React.FC<GlassProgressProps> = ({ 
  value, 
  className, 
  animated = true 
}) => {
  return (
    <div className={cn("glass-panel rounded-full h-2 overflow-hidden", className)}>
      <motion.div
        className="h-full bg-gradient-to-r from-[#F5A623] to-[#E8862B] relative"
        style={{ 
          width: `${Math.max(0, Math.min(100, value))}%`,
          filter: "drop-shadow(0 0 4px rgba(245, 166, 35, 0.6))"
        }}
        initial={animated ? { width: 0 } : false}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Glowing tip */}
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/60 rounded-r-full" />
      </motion.div>
    </div>
  );
};
GlassProgress.displayName = "GlassProgress";