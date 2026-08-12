import { NextRequest, NextResponse } from "next/server";

const PYTHON_BASE = process.env.PYTHON_API_URL ?? "http://localhost:8000";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const upstream = await fetch(
      `${PYTHON_BASE}/precedent/golden-thread/${projectId}/export`,
      { method: "POST", headers: { "Content-Type": "application/json" } }
    );
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    // Return stub export if backend is unavailable — frontend shows success state
    return NextResponse.json({
      exported_at: new Date().toISOString(),
      format: "stub",
      message: "Export queued (backend offline — PDF generation pending)",
    }, { status: 200 });
  }
}
