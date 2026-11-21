import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { FossaPayClient, FossaPayError } from '../src/client.js';
import {
  verifyFossaPayWebhookRaw,
  verifyFossaPayWebhookRequest,
  signFossaPayWebhook,
  resolveWebhookSecret,
} from '../src/webhooks.js';

/**
 * Live-mode contract tests. fetch is stubbed; assertions encode the FossaPay OpenAPI spec
 * (https://docs.fossapay.com/api-reference/openapi.json) and the Node SDK's behaviour.
 */
interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
}

function liveClient(responder: (c: Captured) => { status?: number; json: unknown }) {
  const calls: Captured[] = [];
  const fetchFn = (async (url: string, init: any) => {
    const call: Captured = {
      url: String(url),
      method: init.method,
      headers: init.headers,
      body: init.body ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const { status = 200, json } = responder(call);
    return { ok: status >= 200 && status < 300, status, json: async () => json } as any;
  }) as typeof fetch;
  const client = new FossaPayClient({ apiKey: 'fk_production_test', mode: 'live', fetchFn });
  return { client, calls };
}

const BASE = 'https://api-production.fossapay.com/api/v1';

describe('Live contract: banks and enquiry', () => {
  it('GET /transfers/fiat/banks and maps {bankname, bankcode} -> {name, code}', async () => {
    const { client, calls } = liveClient(() => ({
      json: { status: true, statusCode: 200, message: 'ok', data: [{ bankname: 'Guaranty Trust Bank', bankcode: '058' }] },
    }));
    const banks = await client.transfers.getSupportedBanks();
    expect(calls[0].url).toBe(`${BASE}/transfers/fiat/banks`);
    expect(calls[0].headers['x-api-key']).toBe('fk_production_test');
    expect(banks).toEqual([{ name: 'Guaranty Trust Bank', code: '058' }]);
  });

  it('POST /transfers/fiat/bank-name-enquiry and maps accountName/sessionID', async () => {
    const { client, calls } = liveClient(() => ({
      json: {
        status: true,
        statusCode: 201,
        message: 'ok',
        data: { sessionID: 'S1', destinationInstitutionCode: '058', channelCode: 1, accountNumber: '0123456789', accountName: 'JOHN DOE', kycLevel: '1', responseCode: '00' },
      },
    }));
    const r = await client.transfers.bankEnquiry('0123456789', '058');
    expect(calls[0].url).toBe(`${BASE}/transfers/fiat/bank-name-enquiry`);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toEqual({ accountNumber: '0123456789', bankCode: '058' });
    expect(r).toMatchObject({ accountName: 'JOHN DOE', accountNumber: '0123456789', bankCode: '058', sessionId: 'S1' });
  });

  it('GET /transfers/fiat/calculate-fee maps feeAmount -> fee', async () => {
    const { client, calls } = liveClient(() => ({
      json: { status: true, statusCode: 200, message: 'ok', data: { amount: 5000, currency: 'NGN', feeAmount: 20, total: 5020 } },
    }));
    const r = await client.transfers.calculateFiatFee(5000);
    expect(calls[0].url).toBe(`${BASE}/transfers/fiat/calculate-fee?amount=5000`);
    expect(r).toMatchObject({ amount: '5000.00', fee: '20.00', currency: 'NGN' });
  });
});

describe('Live contract: bank directory quirks', () => {
  it('dedupes repeated bank codes and sorts by name', async () => {
    const { client } = liveClient(() => ({
      json: { status: true, statusCode: 200, message: 'ok', data: [
        { bankname: 'Zenith', bankcode: '057' },
        { bankname: 'Alpha MFB', bankcode: '100042' },
        { bankname: 'Alpha MFB (dup)', bankcode: '100042' },
      ] },
    }));
    const banks = await client.transfers.getSupportedBanks();
    expect(banks.map((b) => b.code)).toEqual(['100042', '057']);
  });
});

describe('Live contract: checkouts', () => {
  const checkoutResponse = {
    status: 'success',
    statusCode: 201,
    message: 'Checkout session created successfully',
    data: {
      id: '35f5f6fb-0c8d-4e96-ba4a-c04750724ff6',
      reference: 'ORDER-10025',
      status: 'pending',
      amount: '5000.00',
      fee: '80.00',
      amountPayable: '5080.00',
      settlementAmount: '5000.00',
      feeBearer: 'customer',
      currency: 'NGN',
      account: { type: 'temporary', bankName: 'Sterling Bank', accountName: 'FOSSAPAY CHECKOUT', accountNumber: '9541382701', expiresAt: '2026-09-11T10:30:00.000Z' },
      customer: null,
      metadata: null,
      transactionId: 'tx',
      providerCheckoutReference: null,
      expiresAt: '2026-09-11T10:30:00.000Z',
      completedAt: null,
      failedAt: null,
      reversedAt: null,
      createdAt: '2026-09-11T10:00:00.000Z',
      updatedAt: '2026-09-11T10:00:00.000Z',
    },
  };

  it('sends only schema-permitted fields and flattens response.account', async () => {
    const { client, calls } = liveClient(() => ({ status: 201, json: checkoutResponse }));
    const rec = await client.checkouts.createCheckout(
      {
        amount: '5000',
        reference: 'ORDER-10025',
        feeBearer: 'buyer', // legacy alias
        customerId: 'cust_should_not_be_sent',
        expiresInMinutes: 30, // not a live field
        description: 'Escrow',
      },
      'checkout-order-10025-v1'
    );
    const c = calls[0];
    expect(c.url).toBe(`${BASE}/checkouts`);
    expect(c.headers['X-Idempotency-Key']).toBe('checkout-order-10025-v1');
    expect(c.body).toEqual({
      amount: 5000,
      currency: 'NGN',
      reference: 'ORDER-10025',
      feeBearer: 'customer',
      metadata: { description: 'Escrow' },
    });
    expect(Number.isInteger(c.body.amount)).toBe(true);
    expect(rec).toMatchObject({ accountNumber: '9541382701', bankName: 'Sterling Bank', amountPayable: '5080.00' });
  });

  it('refuses fractional naira instead of silently rounding money', async () => {
    const { client, calls } = liveClient(() => ({ json: checkoutResponse }));
    await expect(
      client.checkouts.createCheckout({ amount: '1234.50', reference: 'R1', feeBearer: 'customer' }, 'k1')
    ).rejects.toBeInstanceOf(FossaPayError);
    expect(calls).toHaveLength(0);
  });

  it('derives a schema-valid reference from the idempotency key when omitted', async () => {
    const { client, calls } = liveClient(() => ({ status: 201, json: checkoutResponse }));
    await client.checkouts.createCheckout({ amount: 5000 }, 'order 1/attempt#2');
    expect(calls[0].body.reference).toMatch(/^[A-Za-z0-9._:-]{1,100}$/);
  });

  it('supports retrieval by reference and expiry', async () => {
    const { client, calls } = liveClient(() => ({ json: { ...checkoutResponse, statusCode: 200 } }));
    await client.checkouts.getCheckoutByReference('ORDER-10025');
    await client.checkouts.expireCheckout('abc');
    expect(calls[0].url).toBe(`${BASE}/checkouts/reference/ORDER-10025`);
    expect(calls[1].url).toBe(`${BASE}/checkouts/abc/expire`);
    expect(calls[1].method).toBe('POST');
  });
});

describe('Live contract: payouts', () => {
  const payoutResponse = {
    status: 'success',
    statusCode: 202,
    message: 'accepted',
    data: {
      payoutId: 'a9af907d-965f-4ad8-9472-f437fc11df21',
      transactionId: null,
      reference: 'PAYOUT-10025',
      status: 'processing',
      route: 'external_bank',
      amount: '5000.00',
      fee: '80.00',
      totalDebited: '5080.00',
      currency: 'NGN',
      recipient: { bankCode: '058', bankName: 'Guaranty Trust Bank', accountName: 'JOHN DOE', accountNumber: '0123456789' },
      providerReference: 'PYT_1',
      metadata: null,
      completedAt: null,
      failedAt: null,
      reversedAt: null,
    },
  };

  it('uses destination* field names, integer amount, remarks, and maps payoutId -> id', async () => {
    const { client, calls } = liveClient((c) =>
      c.url.endsWith('/transfers/fiat/banks')
        ? { json: { status: true, statusCode: 200, message: 'ok', data: [{ bankname: 'Guaranty Trust Bank', bankcode: '058' }] } }
        : { status: 202, json: payoutResponse }
    );
    const p = await client.payouts.createMasterPayout(
      { accountNumber: '0123456789', bankCode: '058', accountName: 'JOHN DOE', amount: '5000', narration: 'Settlement', reference: 'PAYOUT-10025' },
      'payout-order-10025'
    );
    const post = calls.find((c) => c.url === `${BASE}/payouts`)!;
    expect(post.headers['X-Idempotency-Key']).toBe('payout-order-10025');
    expect(post.body).toEqual({
      amount: 5000,
      currency: 'NGN',
      reference: 'PAYOUT-10025',
      destinationBankCode: '058',
      destinationBankName: 'Guaranty Trust Bank',
      destinationAccountName: 'JOHN DOE',
      destinationAccountNumber: '0123456789',
      remarks: 'Settlement',
    });
    expect(p.id).toBe('a9af907d-965f-4ad8-9472-f437fc11df21');
    // 'processing' must stay non-terminal
    expect(p.status).toBe('processing');
    expect(p.totalDebited).toBe('5080.00');
  });

  it('refuses fractional naira and malformed account numbers', async () => {
    const { client, calls } = liveClient(() => ({ json: payoutResponse }));
    await expect(
      client.payouts.createMasterPayout({ accountNumber: '0123456789', bankCode: '058', bankName: 'GTB', accountName: 'X', amount: '10.50' }, 'k')
    ).rejects.toBeInstanceOf(FossaPayError);
    await expect(
      client.payouts.createMasterPayout({ accountNumber: '12345', bankCode: '058', bankName: 'GTB', accountName: 'X', amount: '100' }, 'k')
    ).rejects.toBeInstanceOf(FossaPayError);
    expect(calls).toHaveLength(0);
  });

  it('requires an idempotency key', async () => {
    const { client } = liveClient(() => ({ json: payoutResponse }));
    await expect(
      client.payouts.createMasterPayout({ accountNumber: '0123456789', bankCode: '058', bankName: 'GTB', accountName: 'X', amount: '100' }, '')
    ).rejects.toThrow(/idempotencyKey/);
  });
});

describe('Live contract: customers, wallets, transfers, KYC', () => {
  it('maps customer fields to the documented names and demands the required ones', async () => {
    const { client, calls } = liveClient(() => ({
      status: 201,
      json: { status: 'success', statusCode: 201, message: 'ok', data: { id: 'c1', emailAddress: 'a@b.co', mobileNumber: '0801', firstName: 'Ada', lastName: 'L', createdAt: 't' } },
    }));
    await expect(client.customers.create({ firstName: 'Ada', lastName: 'L', email: 'a@b.co' })).rejects.toThrow(/dateOfBirth/);
    expect(calls).toHaveLength(0);

    const c = await client.customers.create({
      firstName: 'Ada', lastName: 'L', email: 'a@b.co', phoneNumber: '08012345678',
      dateOfBirth: '1990-08-15', address: '1 Example St', city: 'Lagos', country: 'Nigeria',
    });
    expect(calls[0].url).toBe(`${BASE}/customers`);
    expect(calls[0].body).toMatchObject({ emailAddress: 'a@b.co', mobileNumber: '08012345678', type: 'individual' });
    expect(c).toMatchObject({ id: 'c1', email: 'a@b.co', phoneNumber: '0801' });
  });

  it('lists customers unwrapping pagination envelope { result: [...] }', async () => {
    const { client } = liveClient(() => ({
      status: 200,
      json: {
        status: 'success',
        statusCode: 200,
        data: {
          result: [
            { id: 'c1', emailAddress: 'user1@example.com', mobileNumber: '08011111111', firstName: 'User', lastName: 'One' },
            { id: 'c2', emailAddress: 'user2@example.com', mobileNumber: '08022222222', firstName: 'User', lastName: 'Two' },
          ],
          pagination: { page: 1, limit: 10, total: 2 },
        },
      },
    }));
    const list = await client.customers.list();
    expect(list).toHaveLength(2);
    expect(list[0].email).toBe('user1@example.com');
    expect(list[1].email).toBe('user2@example.com');
  });

  it('creates a fiat wallet with customerId/walletName/walletReference and maps walletId -> id', async () => {
    const { client, calls } = liveClient(() => ({
      status: 201,
      json: { status: 'success', statusCode: 201, message: 'ok', data: { walletId: 'w1', bankName: 'Providus', bankCode: '101', accountName: 'ADA', accountNumber: '1234567890' } },
    }));
    const w = await client.wallets.createFiatWallet({ customerId: 'cust-1' });
    expect(calls[0].url).toBe(`${BASE}/wallets/fiat/create`);
    expect(calls[0].body).toEqual({ customerId: 'cust-1', walletName: 'Wallet cust-1', walletReference: 'wallet_cust-1' });
    expect(w).toMatchObject({ id: 'w1', accountNumber: '1234567890', bankName: 'Providus' });
  });

  it('re-uses existing fiat wallet when create fails with "Wallet already found"', async () => {
    const { client } = liveClient((req) => {
      if (req.url.endsWith('/wallets/fiat/create')) {
        return {
          status: 400,
          json: { status: 'error', statusCode: 400, message: 'Wallet already found for customer' },
        };
      }
      if (req.url.includes('/wallets/fiat/cust-existing')) {
        return { status: 404, json: { status: 'error', statusCode: 404, message: 'Wallet not found' } };
      }
      if (req.url.endsWith('/wallets/fiat')) {
        return {
          status: 200,
          json: {
            status: 'success',
            data: [
              { bankName: 'Sterling Bank', accountName: 'Wallet cust-existing', accountNumber: '9988776655', balance: '0.00' },
            ],
          },
        };
      }
      return { status: 404, json: { status: 'error' } };
    });
    const w = await client.wallets.createFiatWallet({ customerId: 'cust-existing' });
    expect(w.accountNumber).toBe('9988776655');
    expect(w.bankName).toBe('Sterling Bank');
  });

  it('wallet-to-wallet transfer resolves account numbers and posts the documented body', async () => {
    const accounts: Record<string, string> = { wa: '1111111111', wb: '2222222222' };
    const { client, calls } = liveClient((c) => {
      const m = c.url.match(/\/wallets\/fiat\/(w[ab])$/);
      if (m) {
        return { json: { status: true, message: 'ok', data: { id: m[1], customerId: 'c', availableBalance: '0.00', ledgerBalance: '0.00', walletName: 'n', customerType: 'individual', virtualAccount: { accountNumber: accounts[m[1]], bankCode: '1', bankName: 'B' } } } };
      }
      return { status: 200, json: { status: 'success', statusCode: 201, message: 'ok' } };
    });
    const r = await client.wallets.transferFiat({ sourceWalletId: 'wa', destinationWalletId: 'wb', amount: '2500', narration: 'release', reference: 'REL-1' });
    const post = calls.find((c) => c.url === `${BASE}/wallets/fiat/transfers/wallet-to-wallet`)!;
    expect(post.body).toEqual({ fromAccount: '1111111111', toAccount: '2222222222', amount: 2500, reference: 'REL-1', narration: 'release' });
    expect(r).toMatchObject({ reference: 'REL-1', status: 'completed', fee: '0.00' });
  });

  it('KYC: handles the UN-enveloped response, validates 11 digits, never returns the plaintext id number', async () => {
    const { client, calls } = liveClient(() => ({
      json: {
        reference: '11111111-1111-4111-8111-111111111111', method: 'BVN', charged: true, feeAmount: '70.00', currency: 'NGN',
        person: { identityNumber: '01234567890', firstName: 'Ada', middleName: 'Ngozi', lastName: 'Okoro', dateOfBirth: '1990-05-15', gender: 'female', phoneNumber: '0801', email: null, address: null },
      },
    }));
    await expect(client.kyc.verifyIdentity('BVN', '123', 'k')).rejects.toBeInstanceOf(FossaPayError);
    expect(calls).toHaveLength(0);

    const r = await client.kyc.verifyIdentity('BVN', '01234567890', 'ajo_kyc_1');
    expect(calls[0].url).toBe(`${BASE}/kyc/verifications`);
    expect(calls[0].body).toEqual({ method: 'BVN', identityNumber: '01234567890' });
    expect(calls[0].headers['X-Idempotency-Key']).toBe('ajo_kyc_1');
    expect(r).toMatchObject({ verified: true, fullName: 'Ada Ngozi Okoro', last4Digits: '7890' });
    expect(JSON.stringify(r)).not.toContain('01234567890');
  });

  it('KYC: person=null is reported as not verified', async () => {
    const { client } = liveClient(() => ({ json: { reference: 'r', method: 'NIN', charged: true, feeAmount: '120.00', currency: 'NGN', person: null } }));
    const r = await client.kyc.verifyIdentity('NIN', '01234567890', 'k');
    expect(r.verified).toBe(false);
  });
});

describe('Live contract: error handling', () => {
  it('surfaces HTTP errors (e.g. 409 conflict) with status and message', async () => {
    const { client } = liveClient(() => ({ status: 409, json: { status: 'error', statusCode: 409, message: 'Reference already used' } }));
    await expect(client.checkouts.createCheckout({ amount: 100, reference: 'R' }, 'k')).rejects.toMatchObject({ statusCode: 409, message: 'Reference already used' });
  });

  it('treats a boolean status:false body as an error', async () => {
    const { client } = liveClient(() => ({ status: 200, json: { status: false, statusCode: 400, message: 'bad' } }));
    await expect(client.transfers.getSupportedBanks()).rejects.toBeInstanceOf(FossaPayError);
  });

  it('wraps network failures', async () => {
    const client = new FossaPayClient({ apiKey: 'k', mode: 'live', fetchFn: (async () => { throw new TypeError('fetch failed'); }) as any });
    await expect(client.transfers.getSupportedBanks()).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe('Webhook verification: both documented schemes', () => {
  const secret = 'whsec_unit_test';
  const envelope = {
    eventId: 'evt_1',
    eventType: 'checkout.completed',
    data: { checkoutId: 'c', transactionId: 't', reference: 'ORDER-10025', status: 'completed', amount: '5000.00', metadata: { orderId: '10025' } },
    timestamp: '2026-09-11T10:08:14.186Z',
  };
  const raw = JSON.stringify(envelope);

  it('v2: HMAC over the exact raw body (matches @fossapay/node constructEvent)', () => {
    const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    expect(verifyFossaPayWebhookRaw(raw, sig, secret)).toBe(true);
    expect(verifyFossaPayWebhookRaw(raw, sig, 'other')).toBe(false);
    // any byte change (e.g. re-serialised with whitespace) must fail
    expect(verifyFossaPayWebhookRaw(JSON.stringify(envelope, null, 2), sig, secret)).toBe(false);
    expect(verifyFossaPayWebhookRaw(raw, 'zz', secret)).toBe(false);
    expect(verifyFossaPayWebhookRaw(raw, '', secret)).toBe(false);
  });

  it('request verifier accepts v2 or legacy headers (case-insensitive) and reports the scheme', () => {
    const v2 = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const legacy = signFossaPayWebhook(envelope.data, secret);

    expect(verifyFossaPayWebhookRequest(raw, new Headers({ 'X-FossaPay-Signature-V2': v2 }), secret)).toEqual({ valid: true, scheme: 'v2' });
    expect(verifyFossaPayWebhookRequest(raw, new Headers({ 'x-fossapay-Signature': legacy }), secret)).toEqual({ valid: true, scheme: 'legacy' });
    expect(verifyFossaPayWebhookRequest(raw, { 'X-Fossapay-Signature': legacy }, secret).valid).toBe(true);
    expect(verifyFossaPayWebhookRequest(raw, new Headers(), secret)).toEqual({ valid: false, scheme: null });
    // a v2 signature must not validate when placed in the legacy header and vice-versa
    expect(verifyFossaPayWebhookRequest(raw, new Headers({ 'x-fossapay-signature': v2 }), secret).valid).toBe(false);
    expect(verifyFossaPayWebhookRequest(raw, new Headers({ 'x-fossapay-signature-v2': legacy }), secret).valid).toBe(false);
  });

  it('tampering with data invalidates the legacy signature', () => {
    const legacy = signFossaPayWebhook(envelope.data, secret);
    const tampered = JSON.stringify({ ...envelope, data: { ...envelope.data, amount: '999999.00' } });
    expect(verifyFossaPayWebhookRequest(tampered, new Headers({ 'x-fossapay-signature': legacy }), secret).valid).toBe(false);
  });

  it('resolveWebhookSecret fails closed in live mode (no public default secret)', () => {
    expect(resolveWebhookSecret({ FOSSAPAY_MODE: 'live' })).toBeUndefined();
    expect(resolveWebhookSecret({ FOSSAPAY_MODE: 'live', FOSSAPAY_WEBHOOK_SECRET: 'real' })).toBe('real');
    expect(resolveWebhookSecret({})).toBeTruthy(); // mock mode keeps the offline default
  });
});
