import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createWebhookServer } from '../src/server';
import crypto from 'node:crypto';
import { signFossaPayWebhook } from '@fossapay/client';

describe('Webhook Gateway Test Suite', () => {
  let server: http.Server;
  const TEST_PORT = 8099;
  const SECRET = 'unit_test_only_webhook_secret_not_real';

  beforeAll(async () => {
    process.env.PORT = String(TEST_PORT);
    process.env.FOSSAPAY_WEBHOOK_SECRET = SECRET;
    server = createWebhookServer();
    await new Promise<void>((resolve) => server.listen(TEST_PORT, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /platforms/webhook returns 200 with active service status', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/platforms/webhook`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('active');
    expect(json.publicEndpoint).toContain('https://fossapay-demo.reachapp.xyz/platforms/webhook');
  });

  it('POST /platforms/webhook verifies valid HMAC signature calculated over body.data', async () => {
    const payload = {
      eventId: 'evt_test_001',
      eventType: 'checkout.completed',
      timestamp: new Date().toISOString(),
      data: {
        checkoutId: 'chk_test_123',
        amount: '20000.00',
        reference: 'squad_test_001',
        status: 'completed',
      },
    };

    const rawBody = JSON.stringify(payload);
    const validSignature = signFossaPayWebhook(payload.data, SECRET);

    const res = await fetch(`http://localhost:${TEST_PORT}/platforms/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fossapay-signature': validSignature,
      },
      body: rawBody,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(json.signatureVerified).toBe(true);
  });

  it('POST /platforms/webhook rejects (401) an invalid HMAC signature when tampered', async () => {
    const payload = {
      eventId: 'evt_test_tampered',
      eventType: 'payout.completed',
      timestamp: new Date().toISOString(),
      data: {
        payoutId: 'pay_test_999',
        amount: '50000.00',
      },
    };

    const rawBody = JSON.stringify(payload);
    const invalidSignature = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    const res = await fetch(`http://localhost:${TEST_PORT}/platforms/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fossapay-signature': invalidSignature,
      },
      body: rawBody,
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.signatureVerified).toBe(false);
  });

  it('POST /platforms/webhook rejects a delivery with no signature header', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/platforms/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'evt_nosig', eventType: 'checkout.completed', timestamp: new Date().toISOString(), data: { reference: 'x' } }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /platforms/webhook accepts a v2 (raw body HMAC) signature as used by @fossapay/node', async () => {
    const rawBody = JSON.stringify({
      eventId: 'evt_v2_001',
      eventType: 'payout.completed',
      timestamp: new Date().toISOString(),
      data: { payoutId: 'p1', reference: 'PAYOUT-1', status: 'completed' },
    });
    const v2 = crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');
    const res = await fetch(`http://localhost:${TEST_PORT}/platforms/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-fossapay-signature-v2': v2 },
      body: rawBody,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).signatureVerified).toBe(true);
  });

  it('hides every non-webhook route from tunnelled (proxied) requests', async () => {
    const proxied = { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '203.0.113.9' };
    for (const [method, path] of [['POST', '/api/test-trigger'], ['GET', '/api/events'], ['GET', '/']] as const) {
      const res = await fetch(`http://localhost:${TEST_PORT}${path}`, { method, headers: { 'Content-Type': 'application/json', ...proxied }, body: method === 'POST' ? '{}' : undefined });
      expect(res.status, `${method} ${path}`).toBe(404);
    }
  });

  it('refuses to mint signed test events in live mode', async () => {
    process.env.FOSSAPAY_MODE = 'live';
    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/test-trigger`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      expect(res.status).toBe(403);
    } finally {
      delete process.env.FOSSAPAY_MODE;
    }
  });

  it('HTML-escapes webhook payloads in the inspector (no stored XSS)', async () => {
    const payload = { eventId: 'evt_xss', eventType: 'checkout.completed', timestamp: new Date().toISOString(), data: { reference: '<script>alert(1)</script>' } };
    await fetch(`http://localhost:${TEST_PORT}/platforms/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-fossapay-signature': signFossaPayWebhook(payload.data, SECRET) },
      body: JSON.stringify(payload),
    });
    // The gateway records the event after it has already replied, so wait for it to land
    for (let i = 0; i < 40; i++) {
      const events = (await (await fetch(`http://localhost:${TEST_PORT}/api/events`)).json()).data as Array<{ id: string }>;
      if (events.some((e) => e.id === 'evt_xss')) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const html = await (await fetch(`http://localhost:${TEST_PORT}/`)).text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
