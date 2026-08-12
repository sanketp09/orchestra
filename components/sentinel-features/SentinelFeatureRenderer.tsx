"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

// Feature modules
import DuplicateOrderCheckScreen from "@/claude code/Duplicate & Conflicting Order Catcher/component";
import DelayExcuseVerificationScreen from "@/claude code/s Delay Excuse Verification feature/component";
import PayApplicationVerifierMissing from "@/claude code/missing purchase detector/component";
import BidIntegrityAudit from "@/claude code/Bid Integrity & Collusion Check/component";
import MaterialAuthenticationScreen from "@/claude code/material-authentication/component";
import FactoryStatusMonitorScreen from "@/claude code/Factory Cloud/component";
import StatutoryDeadlineTracker from "@/claude code/Statutory Deadline Tracker/component";
import PayApplicationVerifierProof from "@/claude code/Pay Application & Installation Proof/component";
import SentinelPaymentWageIntegrity from "@/claude code/Payment & Wage Integrity Check/component";

interface SentinelFeatureRendererProps {
  skillId: string;
}

export function SentinelFeatureRenderer({ skillId }: SentinelFeatureRendererProps) {
  const renderFeature = () => {
    switch (skillId) {
      case "duplicate_conflicting_order":
      case "duplicate-conflicting-order":
      case "procurement-x-ray":
        return <DuplicateOrderCheckScreen />;
      case "delay_excuse_verification":
      case "delay-excuse-verification":
        return <DelayExcuseVerificationScreen />;
      case "missing_purchase_detector":
      case "missing-purchase-detector":
        return <PayApplicationVerifierMissing />;
      case "bid_integrity_collusion":
      case "bid-integrity-check":
        return <BidIntegrityAudit />;
      case "material_authentication":
      case "material-authentication":
        return <MaterialAuthenticationScreen />;
      case "factory_cloud":
      case "factory-cloud":
        return <FactoryStatusMonitorScreen />;
      case "statutory_deadline_tracker":
      case "statutory-deadline-tracker":
        return <StatutoryDeadlineTracker />;
      case "pay_application_installation_proof":
      case "pay-application-installation-proof":
        return <PayApplicationVerifierProof />;
      case "payment_wage_integrity":
      case "payment-wage-integrity":
      case "wage-payment-integrity":
        return <SentinelPaymentWageIntegrity />;
      default:
        return <DuplicateOrderCheckScreen />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={skillId}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -24, scale: 0.98 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full rounded-[16px] overflow-hidden border border-white/8 shadow-xl bg-[#120E1C] my-6 p-6"
        style={{
          // Base theme color tokens for dark Sentinel wrapper
          "--background": "#120E1C",
          "--foreground": "#FFFFFF",
          "--muted": "rgba(255, 255, 255, 0.45)",
          "--muted-foreground": "rgba(245, 243, 239, 0.45)",
          "--accent": "#7D39EB",
          "--border": "rgba(255, 255, 255, 0.08)",

          // Inner cards: dark surfaces
          "--card": "#1C172E",
          "--card-foreground": "#FFFFFF",
          "--surface-card": "#1C172E",
          "--surface-card-foreground": "#FFFFFF",
          "--surface-floating": "#221A37",

          "--shadow-sm": "0 2px 8px rgba(0, 0, 0, 0.4)",
          "--shadow-md": "0 6px 18px rgba(0, 0, 0, 0.5)",
        } as any}
      >
        <div className="animate-ai-generate">
          {renderFeature()}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
