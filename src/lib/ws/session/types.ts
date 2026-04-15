export interface SessionEntry {
  sessionId: string;
  socketId: string;
  userId?: string;
  connectedAt: Date;
  metadata: Record<string, unknown>;
}

export interface ISessionManager {
  add(sessionId: string, entry: Omit<SessionEntry, "sessionId">): void;
  get(sessionId: string): SessionEntry | undefined;
  getBySocketId(socketId: string): SessionEntry | undefined;
  remove(sessionId: string): boolean;
  removeBySocketId(socketId: string): SessionEntry | undefined;
  list(): SessionEntry[];
  has(sessionId: string): boolean;
  size(): number;
}
