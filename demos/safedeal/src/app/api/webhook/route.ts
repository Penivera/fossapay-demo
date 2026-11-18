import { NextRequest, NextResponse } from 'next/server';
import { verifyFossaPayWebhookRequest, resolveWebhookSecret } from '@fossapay/client';
import { safeDealStore } from '../../../lib/dealStore';

const processedEvents = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const secret = resolveWebhookSecret();
    if (!secret) {
      // Live mode without a configured secret: fail closed rather than trust a public default.
      return NextResponse.json({ status: 'error', message: 'Webhook secret not configured' }, { status: 500 });
    }

    let envelope: any;
    try {
      envelope = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ status: 'error', message: 'Invalid JSON payload' }, { status: 400 });
    }

    // Accepts x-fossapay-signature-v2 (raw body HMAC) or x-fossapay-signature (HMAC over JSON.stringify(data))
    const { valid: isValid } = verifyFossaPayWebhookRequest(rawBody, req.headers, secret);
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
