import type { TypedServer } from "@/lib/ws/types";
import type { ISessionManager } from "@/lib/ws/session/types";
import type {
  PushMessage,
  PushResult,
  INativePushProvider,
  IDeviceRegistry,
} from "./types";

export interface PushServiceDeps {
  io: TypedServer;
  sessionManager: ISessionManager;
  deviceRegistry: IDeviceRegistry;
  nativePushProviders?: INativePushProvider[];
}

/**
 * Central push service — the single decision point for message delivery.
 *
 * Routing logic:
 *   1. Target online?  → Socket.IO real-time delivery
 *   2. Target offline + has push token? → Native push (APNs/FCM)
 *   3. Target offline + no push token? → Stored only (for later retrieval)
 *
 * All paths can optionally persist the message to DB (when persistence is wired in).
 */
export class PushService {
  private io: TypedServer;
  private sessionManager: ISessionManager;
  private deviceRegistry: IDeviceRegistry;
  private providers: Map<string, INativePushProvider>;

  constructor(deps: PushServiceDeps) {
    this.io = deps.io;
    this.sessionManager = deps.sessionManager;
    this.deviceRegistry = deps.deviceRegistry;

    // Index providers by platform for O(1) lookup
    this.providers = new Map();
    for (const provider of deps.nativePushProviders ?? []) {
      this.providers.set(provider.platform, provider);
    }
  }

  /**
   * Deliver a message to the target session.
   * Automatically chooses the best channel.
   */
  async deliver(message: PushMessage): Promise<PushResult> {
    // Channel 1: Socket.IO (target is online)
    if (this.sessionManager.has(message.targetSessionId)) {
      this.io
        .to(`session:${message.targetSessionId}`)
        .emit("message:receive", {
          fromSessionId: message.fromSessionId,
          content: message.content,
          type: message.type,
          metadata: message.metadata,
        });

      return { delivered: true, channel: "socketio" };
    }

    // Target is offline — try native push
    const device = this.deviceRegistry.getBySessionId(
      message.targetSessionId,
    );

    // Channel 2: Native push (APNs / FCM)
    if (device?.pushToken) {
      const provider = this.providers.get(device.platform);

      if (provider) {
        const sent = await provider.send(device.pushToken, {
          title: "新消息",
          body: message.content.slice(0, 100),
          badge: 1,
          data: {
            fromSessionId: message.fromSessionId,
            targetSessionId: message.targetSessionId,
          },
        });

        if (sent) {
          return {
            delivered: true,
            channel: "native",
            detail: device.platform,
          };
        }
      }
    }

    // Channel 3: No delivery channel available — message stored only
    // (When DB persistence is wired in, the message is already saved
    //  before this method is called, or can be saved here.)
    return {
      delivered: false,
      channel: "stored",
      detail: "Target offline, no push token available. Message stored for later delivery.",
    };
  }

  /**
   * Check if a target session can receive real-time messages.
   */
  isOnline(sessionId: string): boolean {
    return this.sessionManager.has(sessionId);
  }
}
