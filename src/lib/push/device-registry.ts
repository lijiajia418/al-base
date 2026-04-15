import type { IDeviceRegistry, DeviceInfo } from "./types";

/**
 * In-memory device registry.
 * Tracks which platform/push token each session is using.
 * Replace with DB-backed implementation for production.
 */
export class DeviceRegistry implements IDeviceRegistry {
  private bySessionId = new Map<string, DeviceInfo>();
  private byUserId = new Map<string, DeviceInfo>();

  register(info: DeviceInfo): void {
    this.bySessionId.set(info.sessionId, info);
    if (info.userId) {
      this.byUserId.set(info.userId, info);
    }
  }

  getByUserId(userId: string): DeviceInfo | undefined {
    return this.byUserId.get(userId);
  }

  getBySessionId(sessionId: string): DeviceInfo | undefined {
    return this.bySessionId.get(sessionId);
  }

  remove(sessionId: string): void {
    const info = this.bySessionId.get(sessionId);
    if (info) {
      this.bySessionId.delete(sessionId);
      // Only remove userId mapping if it points to this session
      if (info.userId && this.byUserId.get(info.userId)?.sessionId === sessionId) {
        this.byUserId.delete(info.userId);
      }
    }
  }
}
