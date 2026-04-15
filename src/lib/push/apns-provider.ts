import type { INativePushProvider, NativeNotification } from "./types";

/**
 * APNs push provider stub.
 *
 * Production implementation should:
 * 1. Use HTTP/2 to connect to api.push.apple.com
 * 2. Sign requests with JWT (Apple P8 key)
 * 3. Handle token invalidation (HTTP 410 → remove device)
 *
 * Required env vars for production:
 *   APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_KEY_PATH
 */
export class APNsProvider implements INativePushProvider {
  readonly platform = "ios";

  async send(pushToken: string, notification: NativeNotification): Promise<boolean> {
    // MVP: log only, no actual APNs call
    console.log(
      `[apns-stub] Would push to token ${pushToken.slice(0, 8)}...: "${notification.title} - ${notification.body}"`,
    );
    return true;
  }
}
