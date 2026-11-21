import { NextRequest, NextResponse } from 'next/server';
import { verifyFossaPayWebhookRequest, resolveWebhookSecret } from '@fossapay/client';
import { intentStore } from '../../../lib/intentStore';

// In-memory set for deduplicating webhook events
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

    // Cryptographic signature check over JSON.stringify(body.data)
    // Accepts x-fossapay-signature-v2 (raw body HMAC), x-fossapay-signature, or x-gateway-secret
    const gatewayHeader = req.headers.get('x-gateway-secret');
    const { valid: isValid } = verifyFossaPayWebhookRequest(rawBody, req.headers, secret);
    const isGatewayValid = Boolean(gatewayHeader && secret && gatewayHeader.trim() === secret.trim());

    if (!isValid && !isGatewayValid) {
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
        // Live payloads expose the provider/NIBSS reference as providerReference (mock: sessionId)
        intentStore.handlePayoutCompletedWebhook(data.payoutId, data.reference, data.sessionId ?? data.providerReference);
      }, 0);
    } else if ((eventType === 'payout.failed' || eventType === 'payout.reversed') && data) {
      setTimeout(() => {
        intentStore.handlePayoutFailedWebhook(data.payoutId, data.reference, eventType);
      }, 0);
    }

    return NextResponse.json({ status: 'success', message: 'Webhook received' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message || 'Webhook processing failed' }, { status: 500 });
  }
}
