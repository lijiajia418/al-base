import type { IHandlerRegistry, CoreDeps } from "@/lib/ws/registry/types";
import type { IDeviceRegistry } from "@/lib/push/types";

interface DeviceDeps extends CoreDeps {
  deviceRegistry: IDeviceRegistry;
}

export function registerDeviceHandlers(
  registry: IHandlerRegistry,
  deps: DeviceDeps,
): void {
  const { deviceRegistry } = deps;

  // Client reports its platform and push token after connecting
  registry.on("device:register", (socket, payload, ack) => {
    const sessionId = socket.data.sessionId;
    const userId = socket.data.userId;

    if (!sessionId) {
      ack({ ok: false, error: "Must join a session before registering device" });
      return;
    }

    deviceRegistry.register({
      userId: userId ?? sessionId,
      sessionId,
      platform: payload.platform,
      pushToken: payload.pushToken,
      registeredAt: new Date(),
    });

    console.log(
      `[ws] device registered: session=${sessionId} platform=${payload.platform} hasPushToken=${!!payload.pushToken}`,
    );

    ack({ ok: true });
  });

  // Clean up device registry on disconnect
  registry.onDisconnect((_socket, _reason, entry) => {
    if (entry) {
      deviceRegistry.remove(entry.sessionId);
    }
  });
}
