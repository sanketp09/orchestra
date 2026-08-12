"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { slideInPanel } from "@/lib/animations";

/**
 * SidePanel — the product's dominant "panel" pattern: a Receipt trail, a
 * flag's detail, a record's evidence. Slides in from the right over 250ms
 * and sits alongside the page — NEVER behind a dimmed backdrop. The page
 * stays interactive underneath. Pair with a layout that reserves space
 * for it (see `contentPushVariants` in lib/animations.ts) rather than
 * absolutely positioning it over content that then becomes unreadable.
 *
 * For genuinely temporary, blocking overlays (search, confirmations), use
 * Dialog instead — see components/ui/dialog.tsx.
 */
export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Panel width in px. Also used by the caller to push page content. */
  width?: number;
  children: React.ReactNode;
  className?: string;
}

export function SidePanel({
  open,
  onClose,
  title,
  description,
  width = 420,
  children,
  className,
}: SidePanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-modal="false"
          aria-label={title}
          variants={slideInPanel}
          initial="hidden"
          animate="visible"
          exit="hidden"
          style={{ width, maxWidth: "100vw" }}
          className={cn(
            "fixed right-0 top-0 z-40 h-screen shrink-0 overflow-y-auto",
            "border-l border-muted bg-background shadow-overlay",
            className
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-muted p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-emphasis font-medium text-foreground">{title}</h2>
              {description && (
                <p className="text-label text-muted-foreground">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
