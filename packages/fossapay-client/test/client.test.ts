import { describe, it } from 'node:test';
import assert from 'node:assert';
import { FossaPayClient, FossaPayError } from '../src/client.js';

describe('FossaPayClient', () => {
  const apiKey = 'fk_production_test_api_key';

  it('fails to instantiate without an apiKey', () => {
    assert.throws(() => new FossaPayClient({ apiKey: '' }), /apiKey is required/);
  });

  it('performs bank enquiry with expected headers and payload', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    const mockFetch = async (url: any, init: any) => {
      capturedUrl = String(url);
      capturedHeaders = init.headers;
      capturedBody = JSON.parse(init.body);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          statusCode: 200,
          message: 'Account resolved',
          data: {
            accountName: 'JOHN DOE',
            accountNumber: '0123456789',
            bankCode: '100004',
            bankName: 'OPAY'
          }
        })
      } as any;
    };

    const client = new FossaPayClient({ apiKey, fetchFn: mockFetch });
    const result = await client.transfers.bankEnquiry({
      accountNumber: '0123456789',
      bankCode: '100004'
    });

    assert.strictEqual(capturedUrl, 'https://api-production.fossapay.com/api/v1/transfers/bank-enquiry');
    assert.strictEqual(capturedHeaders['x-api-key'], apiKey);
    assert.strictEqual(capturedBody.accountNumber, '0123456789');
    assert.strictEqual(result.accountName, 'JOHN DOE');
  });

  it('attaches X-Idempotency-Key header on master payout and validates idempotency requirement', async () => {
    let capturedHeaders: Record<string, string> = {};

    const mockFetch = async (_url: any, init: any) => {
      capturedHeaders = init.headers;
      return {
        ok: true,
        status: 201,
        json: async () => ({
          status: 'success',
          statusCode: 201,
          message: 'Payout created',
          data: {
            id: 'payout_123',
            reference: 'OFFRAMP_01',
            status: 'pending',
            amount: '50000.00',
            fee: '50.00',
            recipient: {
              accountNumber: '0123456789',
              accountName: 'JOHN DOE',
              bankCode: '100004'
            }
          }
        })
      } as any;
    };

    const client = new FossaPayClient({ apiKey, fetchFn: mockFetch });

    // Missing idempotency key should throw
    await assert.rejects(
      async () => client.payouts.createMasterPayout({
        accountNumber: '0123456789',
        bankCode: '100004',
        accountName: 'JOHN DOE',
        amount: 50000
      }, ''),
      /idempotencyKey is required/
    );

    const payout = await client.payouts.createMasterPayout({
      accountNumber: '0123456789',
      bankCode: '100004',
      accountName: 'JOHN DOE',
      amount: 50000
    }, 'idemp_key_unique_001');

    assert.strictEqual(capturedHeaders['X-Idempotency-Key'], 'idemp_key_unique_001');
    assert.strictEqual(payout.id, 'payout_123');
  });

  it('throws FossaPayError on API failure status', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        status: 'error',
        statusCode: 400,
        message: 'Invalid bank account number'
      })
    } as any);

    const client = new FossaPayClient({ apiKey, fetchFn: mockFetch });

    await assert.rejects(
      async () => client.transfers.bankEnquiry({ accountNumber: '999', bankCode: '000' }),
      (err: any) => {
        assert(err instanceof FossaPayError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.message, 'Invalid bank account number');
        return true;
      }
    );
  });
});
