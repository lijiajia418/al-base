import type { IHandlerRegistry, CoreDeps } from "@/lib/ws/registry/types";
import type { PushService } from "@/lib/push";

interface MessagingDeps extends CoreDeps {
  pushService: PushService;
}

export function registerMessagingHandlers(
  registry: IHandlerRegistry,
  deps: MessagingDeps,
): void {
  const { sessionManager, pushService } = deps;

  // payload: DirectMessagePayload — auto-inferred from "message:direct"
  registry.on("message:direct", async (socket, payload) => {
    const senderEntry = sessionManager.getBySocketId(socket.id);

    if (!senderEntry) {
      socket.emit("session:error", {
        code: "NOT_IN_SESSION",
        message: "You must join a session before sending messages",
      });
      return;
    }

    if (!payload.targetSessionId || !payload.content) {
      socket.emit("session:error", {
        code: "INVALID_PAYLOAD",
        message: "targetSessionId and content are required",
      });
      return;
    }

    // Deliver via PushService — automatically routes to the best channel:
    //   online  → Socket.IO real-time
    //   offline → native push (APNs/FCM) or stored for later
    const result = await pushService.deliver({
      fromSessionId: senderEntry.sessionId,
      targetSessionId: payload.targetSessionId,
      content: payload.content,
      type: payload.type ?? "text",
      metadata: payload.metadata,
    });

    if (!result.delivered && result.channel === "stored") {
      // Optionally notify the sender that the target is offline
      socket.emit("session:error", {
        code: "TARGET_OFFLINE",
        message: `Session ${payload.targetSessionId} is offline. Message stored for later delivery.`,
      });
    }
  });
}
