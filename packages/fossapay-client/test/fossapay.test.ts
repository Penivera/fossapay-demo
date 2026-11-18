import { describe, it, expect } from 'vitest';
import { FossaPayClient, FossaPayError } from '../src/client.js';
import { verifyFossaPayWebhook, signFossaPayWebhook, WebhookVerifier } from '../src/webhooks.js';
import {
  toKobo,
  fromKobo,
  formatNGN,
  addMoney,
  subtractMoney,
  distributeAmount,
  verifySum,
} from '../src/money.js';
import { MockFossaPayLedger } from '../src/mock.js';

describe('1. Envelope Unwrapping & Error Handling', () => {
  it('unwraps .data when status is success', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        statusCode: 200,
        message: 'Bank enquiry succeeded',
        data: {
          accountName: 'OLUWASEUN CHUKWUDI ADENIYI',
          accountNumber: '0123456789',
          bankCode: '999992',
          bankName: 'OPay',
        },
      }),
    } as any);

    const client = new FossaPayClient({ apiKey: 'fk_test_123', mode: 'live', fetchFn: mockFetch });
    const result = await client.transfers.bankEnquiry('0123456789', '999992');
    expect(result.accountName).toBe('OLUWASEUN CHUKWUDI ADENIYI');
    expect(result.accountNumber).toBe('0123456789');
  });

  it('throws FossaPayError with statusCode and message on error envelope', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        status: 'error',
        statusCode: 400,
        message: 'Invalid account number length',
        data: null,
      }),
    } as any);

    const client = new FossaPayClient({ apiKey: 'fk_test_123', mode: 'live', fetchFn: mockFetch });
    await expect(client.transfers.bankEnquiry('0123456789', '999992')).rejects.toThrow(FossaPayError);
    await expect(client.transfers.bankEnquiry('0123456789', '999992')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid account number length',
    });
  });

  it('rejects a non-10-digit account number client-side before any network call', async () => {
    let called = false;
    const mockFetch = async () => {
      called = true;
      return {} as any;
    };
    const client = new FossaPayClient({ apiKey: 'fk_test_123', mode: 'live', fetchFn: mockFetch });
    await expect(client.transfers.bankEnquiry('123', '999992')).rejects.toMatchObject({ statusCode: 400 });
    expect(called).toBe(false);
  });

  it('throws when JSON parsing fails', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('Bad Gateway');
      },
    } as any);

    const client = new FossaPayClient({ apiKey: 'fk_test_123', mode: 'live', fetchFn: mockFetch });
    await expect(client.transfers.bankEnquiry('0123456789', '999992')).rejects.toThrow(
      'Failed to parse FossaPay response: HTTP 502'
    );
  });
});

describe('2. Idempotent Replay Returns Original Resource', () => {
  it('replaying a checkout request returns the exact same checkout without duplicate creation', async () => {
    const ledger = new MockFossaPayLedger();
    const client = new FossaPayClient({ mode: 'mock', mockLedger: ledger });

    const key = 'checkout_order_12345_1';
    const req = {
      amount: '15000.00',
      reference: 'squad_room1_userA',
      feeBearer: 'customer' as const,
    };

    const first = await client.checkouts.createCheckout(req, key);
    const second = await client.checkouts.createCheckout(req, key);

    expect(first.id).toBe(second.id);
    expect(first.accountNumber).toBe(second.accountNumber);
    expect(ledger.checkouts.size).toBe(1);
  });

  it('replaying a payout returns the identical payout record without duplicate payout', async () => {
    const ledger = new MockFossaPayLedger({ autoCompletePayouts: false });
    const client = new FossaPayClient({ mode: 'mock', mockLedger: ledger });

    const key = 'offramp_payout_int_8f3a_1';
    const req = {
      accountNumber: '0123456789',
      bankCode: '999992',
      accountName: 'OLUWASEUN ADENIYI',
      amount: '79500.00',
      reference: 'ref_payout_001',
    };

    const first = await client.payouts.createMasterPayout(req, key);
    const second = await client.payouts.createMasterPayout(req, key);

    expect(first.id).toBe(second.id);
    expect(first.reference).toBe(second.reference);
    expect(ledger.payouts.size).toBe(1);
  });

  it('replaying a KYC verification returns the cached verification result', async () => {
    const ledger = new MockFossaPayLedger();
    const client = new FossaPayClient({ mode: 'mock', mockLedger: ledger });

    const key = 'kyc_member_101_bvn_1';
    const first = await client.kyc.verifyIdentity('BVN', '22233344455', key);
    const second = await client.kyc.verifyIdentity('BVN', '22233344455', key);

    expect(first.id).toBe(second.id);
    expect(first.verified).toBe(true);
    expect(first.fullName).toBe('TUNDE BALOGUN');
    expect(ledger.kycVerifications.size).toBe(1);
  });
});

describe('3. Webhook Signature Verification', () => {
  const secret = 'whsec_prod_secret_fossa_998877';

  it('accepts valid HMAC-SHA256 signature calculated over JSON.stringify(body.data)', () => {
    const payload = {
      eventId: 'evt_123456',
      eventType: 'checkout.completed',
      timestamp: '2026-11-03T12:00:00Z',
      data: {
        checkoutId: 'chk_abc123',
        amount: '20000.00',
        status: 'completed',
      },
    };

    const validSig = signFossaPayWebhook(payload.data, secret);
    expect(verifyFossaPayWebhook(payload, validSig, secret)).toBe(true);

    const verifier = new WebhookVerifier(secret);
    expect(verifier.verify(payload, validSig)).toBe(true);
    expect(verifier.isDuplicate(payload.eventId)).toBe(false);
    verifier.markProcessed(payload.eventId);
    expect(verifier.isDuplicate(payload.eventId)).toBe(true);
  });

  it('rejects signature calculated over the entire envelope instead of body.data', () => {
    const payload = {
      eventId: 'evt_123456',
      eventType: 'checkout.completed',
      data: {
        checkoutId: 'chk_abc123',
        amount: '20000.00',
      },
    };

    // Erroneous signature over whole envelope
    const badSig = signFossaPayWebhook(payload as any, secret);
    expect(verifyFossaPayWebhook(payload, badSig, secret)).toBe(false);
  });

  it('rejects tampered body data', () => {
    const payload = {
      data: {
        checkoutId: 'chk_abc123',
        amount: '20000.00',
      },
    };

    const sig = signFossaPayWebhook(payload.data, secret);
    const tamperedPayload = {
      data: {
        checkoutId: 'chk_abc123',
        amount: '99999.00', // tampered amount
      },
    };

    expect(verifyFossaPayWebhook(tamperedPayload, sig, secret)).toBe(false);
  });

  it('rejects signature with incorrect length safely without throwing', () => {
    const payload = { data: { test: 123 } };
    expect(verifyFossaPayWebhook(payload, 'too_short', secret)).toBe(false);
    expect(verifyFossaPayWebhook(payload, 'a'.repeat(128), secret)).toBe(false);
  });

  it('handles empty or missing signature/secret safely', () => {
    expect(verifyFossaPayWebhook(null as any, 'sig', secret)).toBe(false);
    expect(verifyFossaPayWebhook({ data: {} }, '', secret)).toBe(false);
    expect(verifyFossaPayWebhook({ data: {} }, 'sig', '')).toBe(false);
  });
});

describe('4. Monetary Precision & Split Math', () => {
  it('converts between Naira and integer Kobo safely without floating point issues', () => {
    expect(toKobo('0.00')).toBe(0n);
    expect(toKobo('0.01')).toBe(1n);
    expect(toKobo('15000.00')).toBe(1500000n);
    expect(toKobo('420.50')).toBe(42050n);
    expect(toKobo(159450)).toBe(15945000n);

    expect(fromKobo(1n)).toBe('0.01');
    expect(fromKobo(1500000n)).toBe('15000.00');
    expect(fromKobo(42050n)).toBe('420.50');
  });

  it('formats NGN currencies with correct comma separators and symbols', () => {
    expect(formatNGN('159450.00')).toBe('₦159,450.00');
    expect(formatNGN('159450.00', { showSymbol: false })).toBe('159,450.00');
    expect(formatNGN('50.00')).toBe('₦50.00');
  });

  it('adds and subtracts money amounts accurately', () => {
    expect(addMoney('100.25', '50.75')).toBe('151.00');
    expect(subtractMoney('100.25', '50.25')).toBe('50.00');
    expect(() => subtractMoney('50.00', '100.00')).toThrow(/negative monetary amount/);
  });

  it('distributes remainder kobo deterministically across bill participants', () => {
    // ₦100.00 split across 3 people: 10,000 kobo / 3 = 3333 kobo each + 1 kobo remainder
    // Result: [33.34, 33.33, 33.33] summing exactly to 100.00
    const parts3 = distributeAmount('100.00', 3);
    expect(parts3).toEqual(['33.34', '33.33', '33.33']);
    expect(verifySum('100.00', parts3)).toBe(true);

    // ₦1,000.01 split across 4 people: 100,001 kobo / 4 = 25000 kobo each + 1 kobo remainder
    // Result: [250.01, 250.00, 250.00, 250.00]
    const parts4 = distributeAmount('1000.01', 4);
    expect(parts4).toEqual(['250.01', '250.00', '250.00', '250.00']);
    expect(verifySum('1000.01', parts4)).toBe(true);

    // ₦60,000.00 split across 4 people: equal 15,000.00 each
    const partsSquad = distributeAmount('60000.00', 4);
    expect(partsSquad).toEqual(['15000.00', '15000.00', '15000.00', '15000.00']);
    expect(verifySum('60000.00', partsSquad)).toBe(true);
  });
});

describe('5. Mock Ledger Full Domain Operations', () => {
  it('supports customer creation, fiat wallet creation, and zero-fee transfer', async () => {
    const ledger = new MockFossaPayLedger();
    const client = new FossaPayClient({ mode: 'mock', mockLedger: ledger });

    const customerA = await client.customers.create({ firstName: 'Buyer', lastName: 'One' });
    const customerB = await client.customers.create({ firstName: 'Seller', lastName: 'Two' });

    const walletA = await client.wallets.createFiatWallet({ customerId: customerA.id });
    const walletB = await client.wallets.createFiatWallet({ customerId: customerB.id });

    // Fund wallet A in ledger
    walletA.balance = '50000.00';

    // Zero-fee internal transfer
    const transfer = await client.wallets.transferFiat({
      sourceWalletId: walletA.id,
      destinationWalletId: walletB.id,
      amount: '45000.00',
    });

    expect(transfer.fee).toBe('0.00');
    expect(transfer.status).toBe('completed');
    expect(walletA.balance).toBe('5000.00');
    expect(walletB.balance).toBe('45000.00');
  });

  it('determines bank enquiry name deterministically', async () => {
    const client = new FossaPayClient({ mode: 'mock' });
    const resolved = await client.transfers.bankEnquiry('0123456789', '999992');
    expect(resolved.accountName).toBe('OLUWASEUN CHUKWUDI ADENIYI');
    expect(resolved.bankName).toBe('OPay Digital Services');

    const resolved2 = await client.transfers.bankEnquiry('9988776655', '101');
    expect(resolved2.accountName).toBe('TUNDE BALOGUN');
  });

  it('dispatches webhook on simulated checkout payment and payout completion', async () => {
    const ledger = new MockFossaPayLedger({ defaultDelayMs: 10, autoCompletePayouts: true });
    const client = new FossaPayClient({ mode: 'mock', mockLedger: ledger });

    const receivedEvents: any[] = [];
    ledger.addListener((event) => {
      receivedEvents.push(event);
    });

    const chk = await client.checkouts.createCheckout(
      { amount: '10000.00', reference: 'ref_test_webhook' },
      'key_webhook_test_1'
    );

    await ledger.simulateCheckoutPayment(chk.id);

    // Wait for webhook dispatch
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(receivedEvents.some((e) => e.eventType === 'checkout.completed')).toBe(true);

    const payout = await client.payouts.createMasterPayout(
      {
        accountNumber: '0123456789',
        bankCode: '999992',
        accountName: 'OLUWASEUN ADENIYI',
        amount: '9950.00',
      },
      'key_payout_test_1'
    );

    // Wait for autocomplete payout webhook
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(receivedEvents.some((e) => e.eventType === 'payout.completed')).toBe(true);
  });
});
