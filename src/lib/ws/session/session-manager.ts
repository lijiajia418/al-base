import type { ISessionManager, SessionEntry } from "./types";

export class SessionManager implements ISessionManager {
  /** sessionId → SessionEntry */
  private bySessionId = new Map<string, SessionEntry>();
  /** socketId → sessionId (reverse index for O(1) disconnect cleanup) */
  private socketToSession = new Map<string, string>();

  add(
    sessionId: string,
    entry: Omit<SessionEntry, "sessionId">,
  ): void {
    const full: SessionEntry = { ...entry, sessionId };
    this.bySessionId.set(sessionId, full);
    this.socketToSession.set(entry.socketId, sessionId);
  }

  get(sessionId: string): SessionEntry | undefined {
    return this.bySessionId.get(sessionId);
  }

  getBySocketId(socketId: string): SessionEntry | undefined {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return undefined;
    return this.bySessionId.get(sessionId);
  }

  remove(sessionId: string): boolean {
    const entry = this.bySessionId.get(sessionId);
    if (!entry) return false;
    this.bySessionId.delete(sessionId);
    this.socketToSession.delete(entry.socketId);
    return true;
  }

  removeBySocketId(socketId: string): SessionEntry | undefined {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return undefined;
    const entry = this.bySessionId.get(sessionId);
    this.bySessionId.delete(sessionId);
    this.socketToSession.delete(socketId);
    return entry;
  }

  list(): SessionEntry[] {
    return Array.from(this.bySessionId.values());
  }

  has(sessionId: string): boolean {
    return this.bySessionId.has(sessionId);
  }

  size(): number {
    return this.bySessionId.size;
  }
}
