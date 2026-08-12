import { NextRequest, NextResponse } from "next/server";

const PYTHON_BASE = process.env.PYTHON_API_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clauseType = searchParams.get("clause_type") ?? "";
  const vendorId   = searchParams.get("vendor_id")   ?? "";

  try {
    const params = new URLSearchParams({ clause_type: clauseType });
    if (vendorId) params.set("vendor_id", vendorId);

    const upstream = await fetch(`${PYTHON_BASE}/precedent/clause-history?${params}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 503 });
  }
}
