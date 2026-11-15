import { NextRequest, NextResponse } from 'next/server';
import { verifyFossaPayWebhook } from '@fossapay/client';
import { safeDealStore } from '../../../lib/dealStore';

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

    const isValid = verifyFossaPayWebhook(envelope, signature, secret);
    if (!isValid) {
      return NextResponse.json({ status: 'error', message: 'Invalid signature' }, { status: 401 });
    }

    const { eventId, eventType, data } = envelope;
    if (eventId && processedEvents.has(eventId)) {
      return NextResponse.json({ status: 'success', message: 'Event already processed' }, { status: 200 });
    }
    if (eventId) {
      processedEvents.add(eventId);
    }

    // On checkout.completed, unlock escrow for matching deal
    if (eventType === 'checkout.completed' && data?.reference) {
      const dealId = data.reference.replace('ref_', '');
      setTimeout(() => {
        safeDealStore.lockEscrow(dealId).catch(console.error);
      }, 0);
    }

    return NextResponse.json({ status: 'success', message: 'Webhook processed' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
