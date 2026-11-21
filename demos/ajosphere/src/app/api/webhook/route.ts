import { NextRequest, NextResponse } from 'next/server';
import { verifyFossaPayWebhookRequest, resolveWebhookSecret, FossaPayWebhookEvent } from '@fossapay/client';
import { ajoStore } from '@/lib/clubStore';

// In-memory processed events set for deduplication
const processedEvents = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const secret = resolveWebhookSecret();
    if (!secret) {
      return NextResponse.json({ status: 'error', message: 'Webhook secret not configured' }, { status: 500 });
    }

    // Accepts x-fossapay-signature-v2 (raw body HMAC) or x-fossapay-signature (HMAC over JSON.stringify(data))
    const { valid: isValid } = verifyFossaPayWebhookRequest(rawBody, req.headers, secret);
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
      // Documented NGN deposit payloads carry the credited account at data.recipient.accountNumber
      // and a numeric amount; the mock ledger emits a flat data.accountNumber and a string amount.
      const data = payload.data as unknown as {
        accountNumber?: string;
        recipient?: { accountNumber?: string };
        amount?: string | number;
        reference?: string;
      };
      const accountNumber = data.recipient?.accountNumber ?? data.accountNumber;
      if (accountNumber && data.amount !== undefined && data.amount !== null) {
        await ajoStore.recordDeposit(accountNumber, String(data.amount), data.reference as string);
      }
    } else if (payload.eventType === 'checkout.completed') {
      const data = payload.data as unknown as { id?: string; checkoutId?: string };
      const chkId = data?.id ?? data?.checkoutId;
      if (chkId) {
        await ajoStore.handleCheckoutCompletedWebhook(chkId);
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
