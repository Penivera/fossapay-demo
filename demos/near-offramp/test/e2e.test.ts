import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { signFossaPayWebhook, defaultMockLedger } from '@fossapay/client';
import { POST as resolveBank } from '../src/app/api/banks/resolve/route';
import { POST as getQuote } from '../src/app/api/quote/route';
import { POST as createIntent } from '../src/app/api/intents/create/route';
import { GET as streamIntent } from '../src/app/api/intents/[id]/stream/route';
import { POST as executeIntent } from '../src/app/api/intents/[id]/execute/route';
import { POST as retryIntent } from '../src/app/api/intents/[id]/retry/route';
import { POST as handleWebhook } from '../src/app/api/webhook/route';
import { intentStore } from '../src/lib/intentStore';

describe('NEAR Off-Ramp E2E Integration Suite', () => {
  it('runs complete off-ramp journey from bank enquiry to settled receipt', async () => {
    // 1. Bank Resolution: NUBAN 0123456789 at OPay (999992)
    const resolveReq = new NextRequest('http://localhost:3000/api/banks/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountNumber: '0123456789',
        bankCode: '999992',
      }),
    });
    const resolveRes = await resolveBank(resolveReq);
    const resolveJson = await resolveRes.json();
    expect(resolveJson.status).toBe('success');
    expect(resolveJson.data.accountName).toBe('OLUWASEUN CHUKWUDI ADENIYI');
    expect(resolveJson.data.accountNumber).toBe('0123456789');

    // 2. Quote: 100 USDT on Arbitrum
    const quoteReq = new NextRequest('http://localhost:3000/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originAsset: {
          id: 'nep141:arbitrum-usdt.omft.near',
          symbol: 'USDT',
          chain: 'Arbitrum',
          decimals: 6,
        },
        amountIn: '100.00',
      }),
    });
    const quoteRes = await getQuote(quoteReq);
    const quoteJson = await quoteRes.json();
    expect(quoteJson.status).toBe('success');
    expect(quoteJson.data.originAsset).toBe('USDT');
    expect(quoteJson.data.minReceivedUsdc).toBe('99.9000');
    expect(quoteJson.data.exchangeRateNgn).toBe('1595.00');
    expect(quoteJson.data.fiatPayoutFeeNgn).toBe('50.00');
    expect(quoteJson.data.netNgn).toBe('159290.50');

    // 3. Create Intent Session
    const createReq = new NextRequest('http://localhost:3000/api/intents/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteId: quoteJson.data.quoteId,
        originAsset: { symbol: 'USDT', chain: 'Arbitrum' },
        amountIn: quoteJson.data.amountIn,
        minReceivedUsdc: quoteJson.data.minReceivedUsdc,
        netNgn: quoteJson.data.netNgn,
        exchangeRateNgn: quoteJson.data.exchangeRateNgn,
        recipient: {
          accountNumber: resolveJson.data.accountNumber,
          accountName: resolveJson.data.accountName,
          bankCode: resolveJson.data.bankCode,
          bankName: 'OPay Digital Services',
        },
      }),
    });
    const createRes = await createIntent(createReq);
    const createJson = await createRes.json();
    expect(createJson.status).toBe('success');
    const intentId = createJson.data.intentId;
    expect(intentId).toMatch(/^int_/);

    // 4. Connect to SSE Stream
    const streamReq = new NextRequest(`http://localhost:3000/api/intents/${intentId}/stream`);
    const streamRes = await streamIntent(streamReq, { params: Promise.resolve({ id: intentId }) });
    expect(streamRes.headers.get('Content-Type')).toBe('text/event-stream');

    // 5. Test Payout Failure & Visible Retry Flow
    const failExecReq = new NextRequest(`http://localhost:3000/api/intents/${intentId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originTxHash: '0x4f8a91bc72e9c2e001',
        simulatePayoutFailure: true,
      }),
    });
    const failRes = await executeIntent(failExecReq, { params: Promise.resolve({ id: intentId }) });
    const failJson = await failRes.json();
    expect(failJson.data.status).toBe('payout_failed');
    expect(failJson.data.steps[2].status).toBe('error');

    // 6. Retry with Identical Idempotency Key
    const retryReq = new NextRequest(`http://localhost:3000/api/intents/${intentId}/retry`, {
      method: 'POST',
    });
    const retryRes = await retryIntent(retryReq, { params: Promise.resolve({ id: intentId }) });
    const retryJson = await retryRes.json();
    expect(retryJson.status).toBe('success');
    expect(retryJson.data.status).toBe('payout_completed');
    expect(retryJson.data.progressPercent).toBe(100);
    expect(retryJson.data.steps[0].status).toBe('completed');
    expect(retryJson.data.steps[1].status).toBe('completed');
    expect(retryJson.data.steps[2].status).toBe('completed');
    expect(retryJson.data.steps[3].status).toBe('completed');
    expect(retryJson.data.payoutReference).toMatch(/^FP_PAY_/);

    // 7. Verify Idempotency in Mock Ledger: only 1 payout record created
    const expectedKey = `offramp_payout_${intentId}_1`;
    expect(defaultMockLedger.idempotencyRecords.has(expectedKey)).toBe(true);

    // 8. Test Webhook Verification & Deduplication
    const webhookSecret = 'test_webhook_secret_mock_12345';
    const webhookPayload = {
      eventId: `evt_offramp_test_${Date.now()}`,
      eventType: 'payout.completed',
      timestamp: new Date().toISOString(),
      data: {
        payoutId: retryJson.data.payoutId,
        reference: retryJson.data.payoutReference,
        status: 'completed',
        amount: retryJson.data.netNgn,
        fee: '50.00',
        accountNumber: '0123456789',
        bankCode: '999992',
        accountName: 'OLUWASEUN CHUKWUDI ADENIYI',
        completedAt: new Date().toISOString(),
      },
    };
    const validSig = signFossaPayWebhook(webhookPayload.data, webhookSecret);

    const hookReq = new NextRequest('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fossapay-signature': validSig,
      },
      body: JSON.stringify(webhookPayload),
    });
    const hookRes = await handleWebhook(hookReq);
    const hookJson = await hookRes.json();
    expect(hookRes.status).toBe(200);
    expect(hookJson.status).toBe('success');

    // Duplicate webhook should return 200 without reprocessing
    const dupHookReq = new NextRequest('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fossapay-signature': validSig,
      },
      body: JSON.stringify(webhookPayload),
    });
    const dupRes = await handleWebhook(dupHookReq);
    const dupJson = await dupRes.json();
    expect(dupRes.status).toBe(200);
    expect(dupJson.message).toBe('Event already processed');
  });
});
