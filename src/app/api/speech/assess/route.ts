import { NextResponse } from "next/server";
import { createProviders, assessParallel } from "@/lib/speech-assessment";
import type { AssessmentRequest } from "@/lib/speech-assessment";

const providers = createProviders();

/**
 * POST /api/speech/assess
 *
 * Body: { referenceText: string, audioBase64: string, providers: ["azure", "iflytek", "tencent"] }
 * Audio: PCM 16-bit, 16kHz, mono, base64-encoded
 *
 * Returns assessment results from all requested providers in parallel.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AssessmentRequest;

    if (!body.referenceText || !body.audioBase64 || !body.providers?.length) {
      return NextResponse.json(
        { error: "referenceText, audioBase64, and providers[] are required" },
        { status: 400 },
      );
    }

    const response = await assessParallel(body, providers);

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
