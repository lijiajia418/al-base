import { createServer } from "http";
import next from "next";
import { createSocketServer } from "./src/lib/ws/server";
import { SessionManager } from "./src/lib/ws/session/session-manager";
import { setWSContext } from "./src/lib/ws/context";
import { authMiddleware } from "./src/lib/ws/middleware/auth.middleware";
import { registerSessionHandlers } from "./src/domains/session/session.handlers";
import { registerMessagingHandlers } from "./src/domains/messaging/messaging.handlers";
import { registerDeviceHandlers } from "./src/domains/device/device.handlers";
import { registerSpeechHandlers } from "./src/domains/speech/speech.handlers";
import { PushService } from "./src/lib/push/push-service";
import { DeviceRegistry } from "./src/lib/push/device-registry";
import { APNsProvider } from "./src/lib/push/apns-provider";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const sessionManager = new SessionManager();
  const deviceRegistry = new DeviceRegistry();

  const io = createSocketServer({
    httpServer,
    sessionManager,
    middlewares: [authMiddleware],
    handlerRegistrars: [
      registerSessionHandlers,
      (registry, deps) => {
        const pushService = new PushService({
          io: deps.io,
          sessionManager: deps.sessionManager,
          deviceRegistry,
          nativePushProviders: [new APNsProvider()],
        });
        registerMessagingHandlers(registry, { ...deps, pushService });
      },
      (registry, deps) => {
        registerDeviceHandlers(registry, { ...deps, deviceRegistry });
      },
      registerSpeechHandlers,
    ],
    cors: {
      origin: dev ? "*" : (process.env.CORS_ORIGIN || "*"),
      credentials: true,
    },
  });

  // Make io and sessionManager accessible to API routes via typed getters
  setWSContext(io, sessionManager);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server attached`);
  });
});
