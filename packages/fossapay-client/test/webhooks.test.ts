import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { verifyFossaPayWebhook } from '../src/webhooks.js';

describe('verifyFossaPayWebhook', () => {
  const secret = 'whsec_test_secret_key_12345';

  it('validates a correct HMAC signature matching JSON.stringify(body.data)', () => {
    const payload = {
      eventId: 'evt_test_123',
      eventType: 'checkout.completed',
      data: {
        checkoutId: '35f5f6fb-0c8d-4e96-ba4a-c04750724ff6',
        reference: 'ORDER-10025',
        status: 'completed',
        amount: '5000.00'
      },
      timestamp: '2026-11-03T20:00:00.000Z'
    };

    // FossaPay formula: HMAC-SHA256(secret, JSON.stringify(body.data))
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload.data))
      .digest('hex');

    const isValid = verifyFossaPayWebhook(payload, validSignature, secret);
    assert.strictEqual(isValid, true);
  });

  it('rejects if signature was computed over the entire envelope instead of data', () => {
    const payload = {
      eventId: 'evt_test_123',
      eventType: 'checkout.completed',
      data: {
        checkoutId: '35f5f6fb-0c8d-4e96-ba4a-c04750724ff6',
        status: 'completed'
      },
      timestamp: '2026-11-03T20:00:00.000Z'
    };

    // Incorrectly computed over the entire payload
    const invalidSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    const isValid = verifyFossaPayWebhook(payload, invalidSignature, secret);
    assert.strictEqual(isValid, false);
  });

  it('rejects tampered data payload', () => {
    const payload = {
      eventId: 'evt_test_123',
      eventType: 'payout.completed',
      data: {
        payoutId: 'pay_999',
        amount: '100000.00'
      },
      timestamp: '2026-11-03T20:00:00.000Z'
    };

    const signature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload.data))
      .digest('hex');

    // Tamper the data
    payload.data.amount = '200000.00';

    const isValid = verifyFossaPayWebhook(payload, signature, secret);
    assert.strictEqual(isValid, false);
  });

  it('returns false safely when signature or secret is missing', () => {
    assert.strictEqual(verifyFossaPayWebhook({ data: {} }, '', secret), false);
    assert.strictEqual(verifyFossaPayWebhook({ data: {} }, 'some_sig', ''), false);
    assert.strictEqual(verifyFossaPayWebhook(null as any, 'some_sig', secret), false);
  });
});
