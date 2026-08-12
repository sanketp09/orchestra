import React from "react";
import { SentinelCoreOrchestrator } from "@/components/sentinel-core-orchestrator";
import { PublicNavbar } from "@/components/public-navbar";

export const metadata = {
  title: "SENTINEL CORE — Intelligent Procurement Verification System",
  description: "Dynamic orchestration and verification of 9 core procurement features inside Orchestra."
};

export default function SentinelPage() {
  return (
    <main className="min-h-screen bg-[#F3EDE7] text-[#0C0904]">
      <PublicNavbar />
      <div className="pt-6 pb-16">
        <SentinelCoreOrchestrator />
      </div>
    </main>
  );
}
