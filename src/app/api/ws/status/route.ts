import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/ws";

/**
 * GET /api/ws/status
 * Returns all active WebSocket sessions.
 * Used for observability and debugging.
 */
export async function GET() {
  try {
    const sm = getSessionManager();
    const sessions = sm.list().map((entry) => ({
      sessionId: entry.sessionId,
      userId: entry.userId,
      connectedAt: entry.connectedAt.toISOString(),
      socketId: entry.socketId,
    }));

    return NextResponse.json({
      online: sessions.length,
      sessions,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
        online: 0,
        sessions: [],
      },
      { status: 503 },
    );
  }
}
