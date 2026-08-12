"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  Building2,
  GitFork,
  Shuffle,
  TrendingDown,
  DollarSign,
  ShieldCheck,
  Activity,
  Network,
  Tag,
  ChevronLeft,
  LayoutGrid
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Import all 10 feature screens
import SupplierDigitalTwin from "@/claude code/trustline-vendor-profile";
import SupplierWorkspaceScreen from "@/claude code/trustline/extracted/files_2/component";
import AutoPackageSplit from "@/claude code/trustline/extracted/files_5/component";
import BackupSupplierDiscovery from "@/claude code/trustline/extracted/files_4/component";
import RelationshipDecayWarning from "@/claude code/trustline/extracted/files_8/component";
import FinancialDistressWatch from "@/claude code/trustline/extracted/files_11/component";
import SamLicensingWatchScreen from "@/claude code/trustline/extracted/files/component";
import EmrSafetyTrendWatch from "@/claude code/trustline/extracted/files_3/component";
import HiddenOwnershipDetector from "@/claude code/trustline/extracted/files_6/component";
import SupplierCapabilityGraph from "@/claude code/trustline/extracted/files_9/component";

// ---------------------------------------------------------------------------
// Design tokens — ORCHESTRA system (Dark Glassmorphic Neo-Industrial Theme)
// ---------------------------------------------------------------------------
const tokens = {
  background: "#08070C",
  foreground: "#FFFFFF",
  muted: "rgba(255, 255, 255, 0.08)",
  mutedForeground: "rgba(255, 255, 255, 0.45)",
  accent: "#7D39EB",
  surfaceCard: "rgba(255, 255, 255, 0.02)",
  surfaceFloating: "rgba(255, 255, 255, 0.04)",
  success: "#C6FF33",
  warning: "#FBBF24",
  danger: "#F87171",
  info: "#38BDF8",
  ai: "#7D39EB",
};

interface FeatureModule {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<any>;
  tag: string;
  tagColor: string;
}

const FEATURE_MODULES: FeatureModule[] = [
  {
    id: "digital_twin",
    title: "Supplier Digital Twin",
    subtitle: "Meridian Steel master profile & trust trajectory",
    icon: Fingerprint,
    tag: "Master Profile",
    tagColor: tokens.success,
  },
  {
    id: "workspace",
    title: "Supplier Workspace",
    subtitle: "Vendor portal for document submission & compliance status",
    icon: Building2,
    tag: "Vendor Facing",
    tagColor: tokens.info,
  },
  {
    id: "package_split",
    title: "Auto Package Split",
    subtitle: "Algorithmic split logic for redundant PO coverage",
    icon: GitFork,
    tag: "Allocation",
    tagColor: tokens.ai,
  },
  {
    id: "backup_discovery",
    title: "Backup Supplier Discovery",
    subtitle: "Masonry of ranked backup candidates by trust score",
    icon: Shuffle,
    tag: "Redundancy",
    tagColor: tokens.success,
  },
  {
    id: "relationship_decay",
    title: "Relationship Decay Watch",
    subtitle: "SLA response time warning band & engagement audit",
    icon: TrendingDown,
    tag: "Warning",
    tagColor: tokens.warning,
  },
  {
    id: "financial_distress",
    title: "Financial Distress Watch",
    subtitle: "Lien filing timelines & active distress index tracking",
    icon: DollarSign,
    tag: "Risk Watch",
    tagColor: tokens.danger,
  },
  {
    id: "sam_licensing",
    title: "SAM.gov & Licensing Watch",
    subtitle: "Active license countdowns & registry watchdogs",
    icon: ShieldCheck,
    tag: "Compliance",
    tagColor: tokens.success,
  },
  {
    id: "safety_trend",
    title: "EMR & Safety Trend Watch",
    subtitle: "OSHA incident composite metrics & safety logs",
    icon: Activity,
    tag: "Safety",
    tagColor: tokens.info,
  },
  {
    id: "hidden_ownership",
    title: "Hidden Ownership Detector",
    subtitle: "Beneficial owner graphs & parent-subsidiary mappings",
    icon: Network,
    tag: "Corporate",
    tagColor: tokens.ai,
  },
  {
    id: "capability_graph",
    title: "Supplier Capability Graph",
    subtitle: "Faceted query graph of structural fabrication scope",
    icon: Tag,
    tag: "Capabilities",
    tagColor: tokens.mutedForeground,
  },
];

export default function TrustlinePortal() {
  const [activeFeature, setActiveFeature] = useState<string>("digital_twin");
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);

  const renderActiveComponent = () => {
    switch (activeFeature) {
      case "digital_twin":
        return <SupplierDigitalTwin />;
      case "workspace":
        return <SupplierWorkspaceScreen />;
      case "package_split":
        return <AutoPackageSplit />;
      case "backup_discovery":
        return <BackupSupplierDiscovery />;
      case "relationship_decay":
        return <RelationshipDecayWarning />;
      case "financial_distress":
        return <FinancialDistressWatch />;
      case "sam_licensing":
        return <SamLicensingWatchScreen />;
      case "safety_trend":
        return <EmrSafetyTrendWatch />;
      case "hidden_ownership":
        return <HiddenOwnershipDetector />;
      case "capability_graph":
        return <SupplierCapabilityGraph />;
      default:
        return <SupplierDigitalTwin />;
    }
  };

  const currentFeatureDetails = FEATURE_MODULES.find(f => f.id === activeFeature);

  return (
    <div
      className="min-h-screen w-full p-4 md:p-8 flex flex-col gap-6"
      style={{
        backgroundColor: tokens.background,
        backgroundImage: "radial-gradient(circle at 50% 0%, #171228 0%, #08070C 75%)",
        color: tokens.foreground,
        fontFamily: "Inter, sans-serif",
        // CSS variables for child components
        "--background": tokens.background,
        "--foreground": tokens.foreground,
        "--muted": tokens.muted,
        "--muted-foreground": tokens.mutedForeground,
        "--accent": tokens.accent,
        "--card": tokens.surfaceCard,
        "--card-foreground": tokens.foreground,
        "--surface-card": tokens.surfaceCard,
        "--surface-card-foreground": tokens.foreground,
        "--surface-floating": tokens.surfaceFloating,
        "--shadow-sm": "0 2px 8px rgba(0,0,0,0.2)",
        "--shadow-md": "0 6px 18px rgba(0,0,0,0.4)",
      } as any}
    >
      {/* Upper Navigation / Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#7D39EB] text-white shadow-[0_0_15px_rgba(125,57,235,0.4)]">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-extrabold tracking-tight text-white">Trustline Portal</h1>
              <Badge className="bg-[#C6FF33] text-black text-[10px] font-bold uppercase rounded px-1.5 py-0.5">
                Centralized Command Center
              </Badge>
            </div>
            <p className="text-[12px] text-white/60 font-medium">
              Real-time multi-dimensional compliance tracking for subcontractor networks
            </p>
          </div>
        </div>

        {activeFeature !== "digital_twin" && (
          <button
            onClick={() => setActiveFeature("digital_twin")}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg border border-white/10 text-[13px] font-bold transition-all shadow-sm active:scale-95"
          >
            <ChevronLeft size={16} />
            Back to Twin Dashboard
          </button>
        )}
      </div>

      {/* Grid Switcher System */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {FEATURE_MODULES.map((feature, index) => {
          const Icon = feature.icon;
          const isSelected = activeFeature === feature.id;
          const isAnyHovered = hoveredFeature !== null;
          const isCurrentHovered = hoveredFeature === feature.id;

          // Apply blur to non-selected & non-hovered items if hover exists
          const shouldBlur = isAnyHovered ? !isCurrentHovered && !isSelected : false;

          return (
            <motion.button
              key={feature.id}
              onClick={() => setActiveFeature(feature.id)}
              onMouseEnter={() => setHoveredFeature(feature.id)}
              onMouseLeave={() => setHoveredFeature(null)}
              initial={{ opacity: 0, y: 12 }}
              animate={{
                opacity: shouldBlur ? 0.35 : 1,
                filter: shouldBlur ? "blur(2px)" : "blur(0px)",
                scale: isSelected ? 1.02 : isCurrentHovered ? 1.01 : 1,
                y: 0
              }}
              transition={{ duration: 0.35, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
              className={`text-left p-3.5 rounded-xl transition-all flex flex-col justify-between h-[105px] border ${
                isSelected
                  ? "bg-white/[0.06] border-[#C6FF33] shadow-[0_0_15px_rgba(198,255,51,0.15)]"
                  : "bg-white/[0.02] hover:bg-white/[0.04] border-white/5 hover:border-white/10 shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between w-full">
                <span className={`p-1.5 rounded-lg ${isSelected ? "bg-[#C6FF33] text-black" : "bg-white/5 text-white/70"}`}>
                  <Icon size={16} />
                </span>
                <Badge
                  className="text-[9px] font-bold uppercase rounded border px-1.5 py-0 bg-transparent"
                  style={{ borderColor: feature.tagColor, color: feature.tagColor }}
                >
                  {feature.tag}
                </Badge>
              </div>

              <div className="flex flex-col mt-2">
                <span className="text-[12px] font-bold tracking-tight text-white line-clamp-1">
                  {feature.title}
                </span>
                <span className="text-[9.5px] text-white/40 line-clamp-1">
                  {feature.subtitle}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Primary Display Area */}
      <div className="flex-1 rounded-2xl overflow-hidden border border-white/8 bg-white/[0.01] backdrop-blur-xl">
        <div className="bg-white/[0.02] border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
              Active Console Module
            </span>
            <h2 className="text-[16px] font-extrabold text-white mt-0.5">
              {currentFeatureDetails?.title}
            </h2>
          </div>
          <Badge className="bg-[#C6FF33] text-black text-[11px] px-2.5 py-0.5 font-bold uppercase">
            Live Feed
          </Badge>
        </div>

        <div className="relative w-full h-full min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFeature}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0 overflow-y-auto"
            >
              {renderActiveComponent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
