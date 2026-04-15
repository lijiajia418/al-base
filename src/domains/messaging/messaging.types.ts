export interface DirectMessagePayload {
  targetSessionId: string;
  content: string;
  type: "text" | "system";
  metadata?: Record<string, unknown>;
}

export interface MessageReceivedPayload {
  fromSessionId: string;
  content: string;
  type: "text" | "system";
  metadata?: Record<string, unknown>;
}
