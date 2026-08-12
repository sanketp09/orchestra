"use client";

import React from "react";
import { SentinelSkillSelector } from "@/components/sentinel-skill-selector";

export default function XRayPage() {
  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      <SentinelSkillSelector />
    </div>
  );
}
