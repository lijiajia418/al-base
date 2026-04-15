/**
 * A message to be delivered to a target session.
 * PushService decides the channel: Socket.IO (online) or native push (offline).
 */
export interface PushMessage {
  fromSessionId: string;
  targetSessionId: string;
  content: string;
  type: "text" | "system";
  metadata?: Record<string, unknown>;
}

export interface PushResult {
  delivered: boolean;
  channel: "socketio" | "native" | "stored";
  detail?: string;
}

/**
 * Native push provider interface.
 * Implement for APNs (iOS), FCM (Android), etc.
 */
export interface INativePushProvider {
  readonly platform: string;
  send(pushToken: string, notification: NativeNotification): Promise<boolean>;
}

export interface NativeNotification {
  title: string;
  body: string;
  badge?: number;
  data?: Record<string, unknown>;
}

/**
 * Device info registered by the client after connecting.
 */
export interface DeviceInfo {
  userId: string;
  sessionId: string;
  platform: "ios" | "android" | "web";
  pushToken?: string;
  registeredAt: Date;
}

export interface IDeviceRegistry {
  register(info: DeviceInfo): void;
  getByUserId(userId: string): DeviceInfo | undefined;
  getBySessionId(sessionId: string): DeviceInfo | undefined;
  remove(sessionId: string): void;
}
