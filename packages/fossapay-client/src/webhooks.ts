import crypto from 'node:crypto';
import type { WebhookEnvelope } from './types.js';

/**
 * Verifies a FossaPay incoming webhook signature.
 * 
 * FossaPay calculates the signature strictly over `JSON.stringify(body.data)`,
 * not the entire outer envelope.
 * 
 * @param body The parsed or raw webhook envelope object containing `.data`
 * @param signature The signature from the `x-fossapay-signature` HTTP header
 * @param secret The webhook secret configured in FossaPay dashboard
 * @returns boolean indicating whether the signature is cryptographically valid
 */
export function verifyFossaPayWebhook(
  body: WebhookEnvelope<any> | { data: any },
  signature: string | undefined | null,
  secret: string
): boolean {
  if (!body || !body.data || !signature || !secret) {
    return false;
  }

  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body.data))
      .digest('hex');

    const received = String(signature).toLowerCase().trim();

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
