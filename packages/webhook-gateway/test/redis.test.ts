import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { createWebhookServer } from '../src/server';
import {
  getRedisClient,
  recordEvent,
  getEvents,
  updateEvent,
  checkAndMarkDuplicate,
  resetStore,
  closeStore,
  RecordedWebhookEvent,
} from '../src/store';
import { signFossaPayWebhook } from '@fossapay/client';

describe('Redis Webhook Persistence & Deduplication', () => {
  let server: http.Server;
  const TEST_PORT = 8098;
  const SECRET = 'redis_test_secret';
  const REDIS_URL = 'redis://127.0.0.1:6379';

  beforeAll(async () => {
    process.env.PORT = String(TEST_PORT);
    process.env.FOSSAPAY_WEBHOOK_SECRET = SECRET;
    process.env.REDIS_URL = REDIS_URL;

    server = createWebhookServer();
    await new Promise<void>((resolve) => server.listen(TEST_PORT, resolve));
  });

  afterAll(async () => {
    await resetStore();
    await closeStore();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.REDIS_URL;
  });

  beforeEach(async () => {
    await resetStore();
  });

  it('connects to redis client successfully', () => {
    const client = getRedisClient();
    expect(client).not.toBeNull();
  });

  it('persists and retrieves events from Redis', async () => {
    const event: RecordedWebhookEvent = {
      id: 'evt_redis_001',
      receivedAt: new Date().toISOString(),
      signature: 'dummy_sig',
      isValidSignature: true,
      event: {
        eventId: 'evt_redis_001',
        eventType: 'checkout.completed',
        timestamp: new Date().toISOString(),
        data: {
          checkoutId: 'chk_redis_101',
          reference: 'ORDER-101',
          amount: '5000.00',
          amountPayable: '5000.00',
          currency: 'NGN',
          fee: '50.00',
          paidAt: new Date().toISOString(),
          status: 'completed',
        },
      },
      routedTo: [],
    };

    await recordEvent(event);

    const events = await getEvents();
    expect(events.length).toBe(1);
    expect(events[0].id).toBe('evt_redis_001');

    // Update routedTo
    event.routedTo = ['near-offramp (200)'];
    await updateEvent(event);

    const updated = await getEvents();
    expect(updated[0].routedTo).toContain('near-offramp (200)');
  });

  it('correctly detects duplicate event IDs in Redis', async () => {
    const eventId = 'evt_duplicate_check_123';

    const firstAttempt = await checkAndMarkDuplicate(eventId);
    expect(firstAttempt).toBe(false); // First delivery: not a duplicate

    const secondAttempt = await checkAndMarkDuplicate(eventId);
    expect(secondAttempt).toBe(true); // Re-delivery: detected as duplicate
  });

  it('GET /platforms/webhook reports persistence as redis', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/platforms/webhook`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.persistence).toBe('redis');
  });

  it('POST /platforms/webhook deduplicates identical event deliveries', async () => {
    const payload = {
      eventId: 'evt_dedup_http_999',
      eventType: 'checkout.completed',
      timestamp: new Date().toISOString(),
      data: {
        checkoutId: 'chk_dedup_1',
        amount: '1000.00',
        reference: 'dedup_ref_001',
        status: 'completed',
      },
    };

    const rawBody = JSON.stringify(payload);
    const validSignature = signFossaPayWebhook(payload.data, SECRET);

    // First POST
    const res1 = await fetch(`http://localhost:${TEST_PORT}/platforms/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fossapay-signature': validSignature,
      },
      body: rawBody,
    });
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.received).toBe(true);
    expect(json1.duplicate).toBeUndefined();

    // Second POST with same eventId
    const res2 = await fetch(`http://localhost:${TEST_PORT}/platforms/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fossapay-signature': validSignature,
      },
      body: rawBody,
    });
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.received).toBe(true);
    expect(json2.duplicate).toBe(true);
  });
});
