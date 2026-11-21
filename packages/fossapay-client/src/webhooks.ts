import crypto from 'node:crypto';
import type { WebhookEnvelope, FossaPayWebhookEvent } from './types.js';

/**
 * Signs webhook data payload matching FossaPay's signing standard:
 * HMAC-SHA256 hex digest of JSON.stringify(data)
 */
export function signFossaPayWebhook(
  data: Record<string, unknown> | object,
  secret: string
): string {
  if (!data || !secret) {
    throw new Error('data and secret are required for webhook signing');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(data))
    .digest('hex');
}

/**
 * Verifies a FossaPay incoming webhook signature.
 *
 * Strict requirements:
 * 1. Delivery Header: x-fossapay-signature (hex-encoded HMAC-SHA256).
 * 2. Signing Input: JSON.stringify(body.data) (the inner data payload only, NOT the outer envelope).
 * 3. Timing-Safe Comparison using crypto.timingSafeEqual.
 */
export function verifyFossaPayWebhook(
  body: { data?: Record<string, unknown> } | string | null | undefined,
  signature: string | undefined | null,
  secret: string
): boolean {
  if (!body || !signature || !secret) {
    return false;
  }

  try {
    let payloadData: Record<string, unknown> | undefined;

    if (typeof body === 'string') {
      const parsed = JSON.parse(body);
      payloadData = parsed?.data;
    } else {
      payloadData = body.data;
    }

    if (!payloadData || typeof payloadData !== 'object') {
      return false;
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payloadData))
      .digest('hex');

    const received = String(signature).toLowerCase().trim();

    // Constant length check to prevent timing attack on length mismatch
    if (expected.length !== received.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(received, 'utf8')
    );
  } catch {
    return false;
  }
}

/**
 * WebhookVerifier helper class providing timing-safe verification, event parsing, and deduplication tracking.
 */
export class WebhookVerifier {
  private readonly secret: string;
  private readonly processedEvents: Set<string>;

  constructor(secret: string) {
    if (!secret) {
      throw new Error('WebhookVerifier requires a secret');
    }
    this.secret = secret;
    this.processedEvents = new Set<string>();
  }

  /**
   * Verifies the webhook signature.
   */
  verify(
    body: { data?: Record<string, unknown> } | string,
    signature: string | undefined | null
  ): boolean {
    return verifyFossaPayWebhook(body, signature, this.secret);
  }

  /**
   * Checks if an eventId was already processed to prevent duplicate processing.
   */
  isDuplicate(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  /**
   * Records an eventId as processed.
   */
  markProcessed(eventId: string): void {
    this.processedEvents.add(eventId);
  }

  /**
   * Signs a data payload (useful for testing and mock transports).
   */
  sign(data: Record<string, unknown>): string {
    return signFossaPayWebhook(data, this.secret);
  }
}

/**
 * Verifies the v2 signature scheme used by the official `@fossapay/node` SDK (`webhooks.constructEvent`):
 * lowercase hex HMAC-SHA256 over the EXACT raw request body bytes, delivered in `x-fossapay-signature-v2`.
 */
export function verifyFossaPayWebhookRaw(
  rawBody: string | Buffer | null | undefined,
  signature: string | undefined | null,
  secret: string
): boolean {
  if (rawBody === null || rawBody === undefined || rawBody === '' || !signature || !secret) {
    return false;
  }
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(String(signature).trim(), 'hex');
  // Buffer.from(.., 'hex') silently truncates at the first invalid char, so the length guard also rejects junk.
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export type WebhookHeaderSource =
  | Headers
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

function readHeader(headers: WebhookHeaderSource, name: string): string | undefined {
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? undefined;
  }
  const rec = headers as Record<string, string | string[] | undefined>;
  const hit = Object.keys(rec).find((k) => k.toLowerCase() === name.toLowerCase());
  const v = hit ? rec[hit] : undefined;
  return Array.isArray(v) ? v[0] : v;
}

export interface WebhookVerification {
  valid: boolean;
  /** Which scheme matched: `v2` (raw body, x-fossapay-signature-v2) or `legacy` (JSON.stringify(data), x-fossapay-signature). */
  scheme: 'v2' | 'legacy' | null;
}

/**
 * Verifies a webhook delivery from its raw body and headers, accepting either documented scheme:
 *  - `x-fossapay-signature-v2`: HMAC over the raw body (Node SDK / Checkout SDK docs).
 *  - `x-fossapay-signature`: HMAC over JSON.stringify(body.data) (Webhooks docs).
 * Always pass the unparsed request body.
 */
export function verifyFossaPayWebhookRequest(
  rawBody: string | Buffer,
  headers: WebhookHeaderSource,
  secret: string
): WebhookVerification {
  const cleanSecret = secret.trim();
  const v2 = readHeader(headers, 'x-fossapay-signature-v2');
  if (v2 && verifyFossaPayWebhookRaw(rawBody, v2, cleanSecret)) {
    return { valid: true, scheme: 'v2' };
  }
  const legacy = readHeader(headers, 'x-fossapay-signature');
  if (legacy && verifyFossaPayWebhook(rawBody.toString(), legacy, cleanSecret)) {
    return { valid: true, scheme: 'legacy' };
  }
  return { valid: false, scheme: null };
}

export const MOCK_WEBHOOK_SECRET = 'test_webhook_secret_mock_12345';

/**
 * Resolves the webhook secret. The well-known mock secret is only ever allowed in mock mode:
 * in live mode a missing FOSSAPAY_WEBHOOK_SECRET returns undefined so callers reject deliveries
 * instead of accepting forgeries signed with a public default.
 */
export function resolveWebhookSecret(env: Record<string, string | undefined> = process.env): string | undefined {
  const configured = env.FOSSAPAY_WEBHOOK_SECRET || env.FOSSAPAY_SECRET;
  if (configured) return configured.trim();
  return env.FOSSAPAY_MODE === 'live' ? undefined : MOCK_WEBHOOK_SECRET;
}

/** True when the process is configured for live FossaPay (real money). */
export function isLiveMode(env: Record<string, string | undefined> = process.env): boolean {
  return env.FOSSAPAY_MODE === 'live';
}

/**
 * Guard for simulation endpoints (fake payments, fake deliveries, clock advancing, ...).
 * Returns a 403 Response in live mode and null in mock mode:
 *   const denied = denyInLive(); if (denied) return denied;
 */
export function denyInLive(): Response | null {
  if (!isLiveMode()) return null;
  return new Response(
    JSON.stringify({ status: 'error', message: 'Simulation endpoints are disabled in live mode. Real payments arrive via FossaPay webhooks.' }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  );
}
