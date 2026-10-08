import { randomUUID } from "node:crypto";
import {
  SIGNATURE_HEADER,
  signWebhook,
  type WebhookEvent,
  type WebhookEventData,
  type WebhookEventType,
} from "./webhooks";

export type Logger = Pick<Console, "log" | "error">;

export const makeEvent = <T extends WebhookEventType>(
  type: T,
  job: string,
  data: WebhookEventData[T],
  metadata: unknown
) =>
  ({
    id: `evt_${randomUUID()}`,
    type,
    job,
    createdAt: new Date().toISOString(),
    data,
    metadata: metadata ?? null,
  }) as WebhookEvent;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST a signed event. Progress goes once; anything else is retried with
 * backoff (1, 2, 4, 8 s) until the receiver answers 2xx. Never throws.
 */
export const deliver = async (
  url: string,
  secret: string,
  event: WebhookEvent,
  logger: Logger = console
) => {
  const attempts = event.type.endsWith(".progress") ? 1 : 5;
  const body = JSON.stringify(event);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "seamtranscode",
          // signed per attempt, so a late retry is still inside the window
          [SIGNATURE_HEADER]: await signWebhook(body, secret),
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return true;
      // 4xx other than 408/429 won't get better by asking again
      if (res.status < 500 && res.status !== 408 && res.status !== 429) {
        logger.error(`[webhook] ${event.type} rejected with ${res.status}`);
        return false;
      }
      if (attempt === attempts) {
        logger.error(`[webhook] ${event.type} failed with ${res.status}`);
      }
    } catch (err) {
      if (attempt === attempts) {
        logger.error(`[webhook] ${event.type} failed:`, err);
      }
    }
    if (attempt < attempts) await sleep(1000 * 2 ** (attempt - 1));
  }
  return false;
};
