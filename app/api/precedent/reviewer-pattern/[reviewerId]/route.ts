import { NextRequest, NextResponse } from "next/server";

const PYTHON_BASE = process.env.PYTHON_API_URL ?? "http://localhost:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reviewerId: string }> }
) {
  try {
    const { reviewerId } = await params;
    const upstream = await fetch(
      `${PYTHON_BASE}/precedent/reviewer-pattern/${reviewerId}`,
      { headers: { "Content-Type": "application/json" } }
    );
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 503 });
  }
}
