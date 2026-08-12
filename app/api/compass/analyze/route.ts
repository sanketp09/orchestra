import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const PYTHON_BASE = process.env.PYTHON_API_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { inputText = "", fileName = "" } = body;

    if (!inputText.trim()) {
      return NextResponse.json(
        { error: "Input text must not be empty." },
        { status: 400 }
      );
    }

    // Try calling the FastAPI server first
    try {
      const response = await fetch(`${PYTHON_BASE}/api/compass/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText, fileName }),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch (fetchErr) {
      console.warn("FastAPI connection failed, falling back to CLI execution:", fetchErr);
    }

    // Fallback: Run Python verification engine directly via python CLI script call
    const pyScript = `import json, sys, asyncio; sys.path.append('${path.join(process.cwd(), "sentinel").replace(/\\/g, "/")}'); from app.services.compass_core import process_compass_analysis; res = asyncio.run(process_compass_analysis('''${inputText.replace(/'/g, "\\'")}''', '''${fileName.replace(/'/g, "\\'")}''')); print(json.dumps(res))`;

    const { stdout } = await execAsync(`python -c "${pyScript.replace(/"/g, '\\"')}"`);
    const parsed = JSON.parse(stdout.trim());
    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error("Compass orchestration failure:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process compass analysis." },
      { status: 500 }
    );
  }
}
