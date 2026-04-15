import { NextResponse } from "next/server";
import { getIO, getSessionManager } from "@/lib/ws";

/**
 * POST /api/ws/push
 * Push a message to a specific session from the backend.
 *
 * Body: { sessionId: string, content: string }
 *
 * Demonstrates server-initiated push via API route.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, content } = body as {
      sessionId?: string;
      content?: string;
    };

    if (!sessionId || !content) {
      return NextResponse.json(
        { error: "sessionId and content are required" },
        { status: 400 },
      );
    }

    const sm = getSessionManager();
    const entry = sm.get(sessionId);

    if (!entry) {
      return NextResponse.json(
        { error: `Session ${sessionId} is not online` },
        { status: 404 },
      );
    }

    const io = getIO();
    io.to(`session:${sessionId}`).emit("message:receive", {
      fromSessionId: "server",
      content,
      type: "system",
    });

    return NextResponse.json({ ok: true, deliveredTo: sessionId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 503 },
    );
  }
}
