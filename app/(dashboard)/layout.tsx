"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid, FileSearch, ShieldCheck, FileText,
  Smartphone, Building2, ChevronLeft, ChevronRight, Home, BookOpen, Compass, Globe
} from "lucide-react";
import { GlobalSearch } from "@/components/global-search";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Decision Center",    icon: LayoutGrid  },
  { href: "/compass",   label: "Compass Core",       icon: Compass     },
  { href: "/atlas",     label: "Atlas Intel",        icon: Globe       },
  { href: "/xray",      label: "Sentinel",           icon: FileSearch  },
  { href: "/trustline", label: "Trustline Portal",   icon: ShieldCheck },
  { href: "/evidence",  label: "Receipt Center",     icon: FileText    },
  { href: "/precedent", label: "Precedent",          icon: BookOpen    },
  { href: "/supplier",  label: "Supplier Workspace", icon: Building2   },
  { href: "/site",      label: "Mobile Site Capture",icon: Smartphone  },
];

function generateBreadcrumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = [{ label: "Dashboard", href: "/dashboard" }];
  if (parts[0] === "compass")   crumbs.push({ label: "Compass Core",       href: "/compass" });
  else if (parts[0] === "atlas") crumbs.push({ label: "Atlas Intel",       href: "/atlas" });
  else if (parts[0] === "xray")       crumbs.push({ label: "Sentinel",           href: "/xray" });
  else if (parts[0] === "trustline") crumbs.push({ label: "Trustline Portal",  href: "/trustline" });
  else if (parts[0] === "vendor"){
    crumbs.push({ label: "Vendor Trustline", href: "/vendor/v1" });
    if (parts[1]) crumbs.push({ label: parts[1]==="v1"?"ABC Steel":parts[1]==="v2"?"Steel Rebar Co.":"Ferrovial MEP", href: pathname });
  }
  else if (parts[0] === "evidence") crumbs.push({ label: "Receipt Center",     href: "/evidence" });
  else if (parts[0] === "precedent") crumbs.push({ label: "Precedent",          href: "/precedent" });
  else if (parts[0] === "supplier") crumbs.push({ label: "Supplier Workspace", href: "/supplier/v1" });
  else if (parts[0] === "site")     crumbs.push({ label: "Mobile Site Capture",href: "/site" });
  return crumbs;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const breadcrumbs = generateBreadcrumbs(pathname);

  return (
    <div className="flex h-screen w-full flex-col bg-[#08070C] text-[#FFFFFF] antialiased relative overflow-hidden">
      {/* Drifting Background Glow Mesh */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="bg-mesh-glow-1 top-[-20%] left-[-10%]" />
        <div className="bg-mesh-glow-2 bottom-[10%] right-[-10%]" />
      </div>

      {/* ── TOP NAV ──────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/8 bg-[#08070C]/50 backdrop-blur-md px-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#7D39EB]">
              <Home size={14} className="text-[#C6FF33]" />
            </span>
            <span className="text-[16px] font-bold tracking-tight text-white">
              ORCHESTRA
            </span>
          </Link>
          <span className="hidden sm:inline rounded-[4px] border border-white/10 px-2 py-0.5 text-[11.5px] font-medium bg-white/5 text-white/70">
            Meridian Construction Group
          </span>
        </div>

        {/* Search */}
        <div className="hidden flex-1 max-w-[380px] md:flex md:mx-8">
          <GlobalSearch />
        </div>

        {/* Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold bg-[#7D39EB] text-white ring-1 ring-[#C6FF33]">
          MT
        </div>
      </motion.header>

      {/* ── BREADCRUMB ───────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/8 bg-[#08070C]/30 backdrop-blur-sm px-6 py-2 text-[12px] font-medium text-white/50 relative z-10">
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.href}>
            {idx > 0 && <span className="text-white/20">/</span>}
            <Link
              href={crumb.href}
              className="transition-colors hover:text-[#C6FF33] hover:underline"
              style={{
                color: idx === breadcrumbs.length - 1 ? "#C6FF33" : "rgba(255, 255, 255, 0.6)",
                fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400
              }}
            >
              {crumb.label}
            </Link>
          </React.Fragment>
        ))}
      </div>

      {/* ── BODY ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden p-3 gap-3">
        {/* ── SIDEBAR ──────────────────────────────────────── */}
        <motion.nav
          animate={{ width: collapsed ? 60 : 224 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className="relative z-20 hidden shrink-0 flex-col glass-panel py-4 sm:flex overflow-hidden"
        >
          <ul className="flex flex-col gap-1.5 px-2 flex-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === "/dashboard"
                ? pathname === "/dashboard" || pathname === "/"
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              const dest = item.href === "/vendor" ? "/vendor/v1"
                         : item.href === "/supplier" ? "/supplier/v1"
                         : item.href;
              return (
                <li key={item.href} className="relative animate-fade-up">
                  <Link
                    href={dest}
                    className={cn(
                      "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition-all duration-150 z-10",
                      isActive ? "font-semibold text-white" : "font-normal text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-lg z-0 border-l-2 border-[#C6FF33]"
                        style={{ background: "rgba(125, 57, 235, 0.25)" }}
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <Icon
                      size={18}
                      strokeWidth={1.8}
                      className={cn(
                        "relative z-10 shrink-0",
                        isActive ? "text-[#C6FF33]" : "text-white/60"
                      )}
                    />
                    {!collapsed && (
                      <span className={cn(
                        "relative z-10 whitespace-nowrap overflow-hidden transition-colors",
                        isActive ? "text-[#C6FF33]" : ""
                      )}>
                        {item.label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Collapse toggle */}
          <div className="px-2 pt-3 border-t border-white/8">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex w-full items-center justify-center rounded-lg p-2 transition-colors hover:bg-white/5 text-white/60 hover:text-[#C6FF33]"
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>
        </motion.nav>

        {/* ── MAIN CONTENT ─────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto glass-panel relative z-10 p-6 scrollbar-cyber">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
