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
