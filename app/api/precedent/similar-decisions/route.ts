import { NextRequest, NextResponse } from "next/server";

const PYTHON_BASE = process.env.PYTHON_API_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const upstream = await fetch(`${PYTHON_BASE}/precedent/similar-decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 503 });
  }
}
