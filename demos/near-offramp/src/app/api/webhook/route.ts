import { NextRequest, NextResponse } from 'next/server';
import { verifyFossaPayWebhook } from '@fossapay/client';
import { intentStore } from '../../../lib/intentStore';

// In-memory set for deduplicating webhook events
const processedEvents = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-fossapay-signature');
    const secret = process.env.FOSSAPAY_WEBHOOK_SECRET || 'test_webhook_secret_mock_12345';

    let envelope: any;
    try {
      envelope = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ status: 'error', message: 'Invalid JSON payload' }, { status: 400 });
    }

    // Cryptographic signature check over JSON.stringify(body.data)
    const isValid = verifyFossaPayWebhook(envelope, signature, secret);
    if (!isValid) {
      return NextResponse.json({ status: 'error', message: 'Invalid signature' }, { status: 401 });
    }

    // Deduplication check
    const { eventId, eventType, data } = envelope;
    if (eventId && processedEvents.has(eventId)) {
      return NextResponse.json({ status: 'success', message: 'Event already processed' }, { status: 200 });
    }
    if (eventId) {
      processedEvents.add(eventId);
    }

    // Asynchronously dispatch domain task
    if (eventType === 'payout.completed' && data) {
      setTimeout(() => {
        intentStore.handlePayoutCompletedWebhook(data.payoutId, data.reference, data.sessionId);
      }, 0);
    }

    return NextResponse.json({ status: 'success', message: 'Webhook received' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message || 'Webhook processing failed' }, { status: 500 });
  }
}
