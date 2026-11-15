import { NextRequest, NextResponse } from 'next/server';
import { verifyFossaPayWebhook, FossaPayWebhookEvent } from '@fossapay/client';
import { ajoStore } from '@/lib/clubStore';

// In-memory processed events set for deduplication
const processedEvents = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-fossapay-signature');
    const secret = process.env.FOSSAPAY_WEBHOOK_SECRET || 'fossa_whsec_mock_shared_secret';

    const isValid = verifyFossaPayWebhook(rawBody, signature, secret);
    if (!isValid) {
      console.warn('[AjoSphere Webhook] Invalid HMAC signature');
      return NextResponse.json({ status: 'error', message: 'Invalid webhook signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as FossaPayWebhookEvent;

    // Fast deduplication
    if (processedEvents.has(payload.eventId)) {
      return NextResponse.json({ status: 'ignored', message: 'Event already processed' }, { status: 200 });
    }
    processedEvents.add(payload.eventId);

    // Domain processing
    if (payload.eventType === 'deposit.completed') {
      const { accountNumber, amount, reference } = payload.data;
      if (accountNumber && amount) {
        await ajoStore.recordDeposit(accountNumber, amount, reference);
      }
    } else if (payload.eventType === 'payout.completed') {
      console.log(`[AjoSphere Webhook] Payout ${payload.data.payoutId} confirmed complete`);
    }

    return NextResponse.json({ status: 'success', received: true }, { status: 200 });
  } catch (err) {
    console.error('[AjoSphere Webhook Error]:', err);
    return NextResponse.json({ status: 'error', message: 'Webhook handler error' }, { status: 500 });
  }
}
