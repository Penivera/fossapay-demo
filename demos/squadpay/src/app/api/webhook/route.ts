import { NextRequest, NextResponse } from 'next/server';
import { verifyFossaPayWebhookRequest, resolveWebhookSecret } from '@fossapay/client';
import { squadPayStore } from '../../../lib/roomStore';

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

    // Accepts x-fossapay-signature-v2 (raw body HMAC), x-fossapay-signature, or x-gateway-secret
    const gatewayHeader = req.headers.get('x-gateway-secret');
    const { valid: isValid } = verifyFossaPayWebhookRequest(rawBody, req.headers, secret);
    const isGatewayValid = Boolean(gatewayHeader && secret && gatewayHeader.trim() === secret.trim());

    if (!isValid && !isGatewayValid) {
      return NextResponse.json({ status: 'error', message: 'Invalid signature' }, { status: 401 });
    }

    const eventType = envelope.eventType || envelope.type;
    const data = envelope.data || envelope;
    const eventId = envelope.eventId || envelope.id;
    if (eventId && processedEvents.has(eventId)) {
      return NextResponse.json({ status: 'success', message: 'Event already processed' }, { status: 200 });
    }
    if (eventId) {
      processedEvents.add(eventId);
    }

    // Match reference: squad_<roomId>_<participantId>
    const reference = data?.reference || envelope?.reference;
    if (eventType === 'checkout.completed' && reference) {
      const match = reference.match(/^squad_([^_]+)_(.+)$/);
      if (match) {
        const roomId = match[1];
        const participantId = match[2];
        setTimeout(() => {
          squadPayStore.markParticipantPaid(roomId, participantId).catch(console.error);
        }, 0);
      }
    }

    return NextResponse.json({ status: 'success', message: 'Webhook processed' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
