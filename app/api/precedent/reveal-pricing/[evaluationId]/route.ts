import { NextRequest, NextResponse } from "next/server";

const PYTHON_BASE = process.env.PYTHON_API_URL ?? "http://localhost:8000";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ evaluationId: string }> }
) {
  try {
    const { evaluationId } = await params;
    const upstream = await fetch(
      `${PYTHON_BASE}/precedent/reveal-pricing/${evaluationId}`,
      { method: "POST", headers: { "Content-Type": "application/json" } }
    );
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 503 });
  }
}
