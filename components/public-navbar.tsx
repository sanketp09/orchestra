"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Menu, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();

  // Map scroll position to text colors for the landing page start frame
  const bgOpacity = useTransform(scrollY, [0, 80], [0, 0.85]);
  const backdropBlur = useTransform(scrollY, [0, 80], ["blur(0px)", "blur(20px)"]);
  const borderOpacity = useTransform(scrollY, [0, 80], ["rgba(255,255,255,0)", "rgba(255,255,255,0.08)"]);
  const shadowOpacity = useTransform(scrollY, [0, 80], ["rgba(0,0,0,0)", "rgba(0,0,0,0.5)"]);
  
  const textColor = useTransform(scrollY, [0, 80], ["#000000", "#ffffff"]);
  const textMutedColor = useTransform(scrollY, [0, 80], ["rgba(0,0,0,0.6)", "rgba(255,255,255,0.65)"]);
  const buttonBorderColor = useTransform(scrollY, [0, 80], ["rgba(0,0,0,0.12)", "rgba(255,255,255,0.1)"]);
  const hamburgerColor = useTransform(scrollY, [0, 80], ["#000000", "#ffffff"]);

  const navLinks = [
    { href: "/sentinel", label: "Sentinel Core" },
    { href: "#systems", label: "Systems" },
    { href: "/supplier/v1", label: "Vendor Workspace" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <>
      <motion.nav
        style={{
          backgroundColor: useTransform(bgOpacity, (v) => `rgba(8, 7, 12, ${v})`),
          backdropFilter: backdropBlur,
          borderBottomColor: borderOpacity,
          boxShadow: useTransform(shadowOpacity, (v) => `0 4px 20px ${v}`),
        }}
        className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-transparent px-8 transition-colors duration-100 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Sparkles size={16} className="text-[#C6FF33] drop-shadow-[0_0_8px_rgba(198,255,51,0.5)] animate-pulse" />
          <Link href="/" className="text-[17px] font-bold tracking-tight hover:text-[#C6FF33] transition-colors">
            <motion.span style={{ color: textColor }}>ORCHESTRA</motion.span>
          </Link>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[13.5px] font-medium hover:text-[#C6FF33] transition-colors"
            >
              <motion.span style={{ color: textMutedColor }}>{link.label}</motion.span>
            </Link>
          ))}
        </div>

        {/* Sentinel Core & Launch Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <motion.div style={{ borderColor: buttonBorderColor }} className="border rounded-[6px] overflow-hidden">
            <Button asChild variant="ghost" size="sm" className="h-8 rounded-[6px] text-white font-semibold hover:bg-white/5 hover:text-[#C6FF33] border-0 px-3 bg-transparent">
              <Link href="/sentinel" className="flex items-center">
                <motion.span style={{ color: textColor }}>⚡ Sentinel Core</motion.span>
              </Link>
            </Button>
          </motion.div>
          <Button asChild variant="primary" size="sm" className="rounded-[8px] btn-lime border-0">
            <Link href="/dashboard">Launch Dashboard</Link>
          </Button>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 md:hidden hover:bg-white/5 rounded-md"
        >
          <motion.svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: hamburgerColor }}
          >
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </motion.svg>
        </button>
      </motion.nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-50 bg-[#08070C]/80 backdrop-blur-sm md:hidden"
            />

            {/* Sidebar drawer content */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-72 bg-[#08070C] p-6 shadow-2xl md:hidden border-l border-white/8"
            >
              <div className="flex items-center justify-between border-b border-white/8 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[#C6FF33]" />
                  <span className="text-[16px] font-bold text-white">ORCHESTRA</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-white hover:bg-white/5 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-5">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-[15px] font-medium text-white/60 hover:text-[#C6FF33] transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="border-t border-white/8 pt-5 mt-4">
                  <Button asChild variant="primary" className="w-full text-center btn-lime border-0">
                    <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                      Launch Dashboard
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
