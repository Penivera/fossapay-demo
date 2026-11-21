import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { defaultMockLedger, signFossaPayWebhook } from '@fossapay/client';
import { POST as createDeal } from '../src/app/api/deals/route';
import { GET as getDeal } from '../src/app/api/deals/[id]/route';
import { POST as initiateCheckout } from '../src/app/api/deals/[id]/checkout/route';
import { POST as simulatePayment } from '../src/app/api/deals/[id]/simulate-payment/route';
import { POST as dispatchDeal } from '../src/app/api/deals/[id]/dispatch/route';
import { POST as simulateDelivery } from '../src/app/api/deals/[id]/simulate-delivery/route';
import { POST as releaseDeal } from '../src/app/api/deals/[id]/release/route';
import { POST as disputeDeal } from '../src/app/api/deals/[id]/dispute/route';
import { POST as refundBuyer } from '../src/app/api/deals/[id]/refund-buyer/route';
import { POST as syncDeal } from '../src/app/api/deals/sync/route';
import { GET as getAdminDeals } from '../src/app/api/admin/deals/route';
import { safeDealStore } from '../src/lib/dealStore';

describe('SafeDeal Escrow Lifecycle E2E Suite', () => {
  it('runs complete happy path: creation -> escrow lock -> dispatch -> inspect -> release', async () => {
    // 1. Seller creates deal
    const createReq = new NextRequest('http://localhost:3001/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'iPhone 13 - 128GB Midnight',
        description: 'Brand new open box. 100% battery health.',
        price: '420000.00',
        inspectionPeriodSeconds: 15,
        seller: {
          name: 'Tunde Balogun',
          phone: '08099887766',
          email: 'tunde@safedeal.ng',
          bankName: 'Guaranty Trust Bank',
          bankCode: '058',
          accountNumber: '9988776655',
          accountName: 'TUNDE BALOGUN',
        },
      }),
    });
    const createRes = await createDeal(createReq);
    const createJson = await createRes.json();
    expect(createJson.status).toBe('success');
    const dealId = createJson.data.id;
    expect(dealId).toMatch(/^sd_/);
    expect(createJson.data.status).toBe('DRAFT');

    // 2. Buyer opens link and initiates checkout
    const checkoutReq = new NextRequest(`http://localhost:3001/api/deals/${dealId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Chidinma Okonkwo',
        phone: '08011223344',
        email: 'chidinma@example.com',
      }),
    });
    const checkoutRes = await initiateCheckout(checkoutReq, { params: Promise.resolve({ id: dealId }) });
    const checkoutJson = await checkoutRes.json();
    expect(checkoutJson.status).toBe('success');
    expect(checkoutJson.data.status).toBe('WAITING_PAYMENT');
    expect(checkoutJson.data.checkout.accountNumber).toBeDefined();

    // 3. Buyer transfers funds -> escrow is locked
    const payReq = new NextRequest(`http://localhost:3001/api/deals/${dealId}/simulate-payment`, {
      method: 'POST',
    });
    const payRes = await simulatePayment(payReq, { params: Promise.resolve({ id: dealId }) });
    const payJson = await payRes.json();
    expect(payJson.status).toBe('success');
    expect(payJson.data.status).toBe('ESCROW_LOCKED');

    // 4. Seller marks dispatched via courier
    const dispatchReq = new NextRequest(`http://localhost:3001/api/deals/${dealId}/dispatch`, {
      method: 'POST',
    });
    const dispatchRes = await dispatchDeal(dispatchReq, { params: Promise.resolve({ id: dealId }) });
    const dispatchJson = await dispatchRes.json();
    expect(dispatchJson.data.status).toBe('DISPATCHED');

    // 5. Courier confirms delivery drop-off -> inspection window begins
    const deliveryReq = new NextRequest(`http://localhost:3001/api/deals/${dealId}/simulate-delivery`, {
      method: 'POST',
    });
    const deliveryRes = await simulateDelivery(deliveryReq, { params: Promise.resolve({ id: dealId }) });
    const deliveryJson = await deliveryRes.json();
    expect(deliveryJson.data.status).toBe('INSPECTION_PERIOD');
    expect(deliveryJson.data.inspectionExpiresAt).toBeDefined();

    // 6. Buyer inspects and accepts goods -> funds released
    const releaseReq = new NextRequest(`http://localhost:3001/api/deals/${dealId}/release`, {
      method: 'POST',
    });
    const releaseRes = await releaseDeal(releaseReq, { params: Promise.resolve({ id: dealId }) });
    const releaseJson = await releaseRes.json();
    expect(releaseJson.data.status).toBe('RELEASED');
    expect(releaseJson.data.releasePayoutRef).toMatch(/^FP_SD_REL_/);

    // 7. Verify Idempotency in Mock Ledger: exact key was recorded
    const expectedKey = `safedeal_release_payout_${dealId}_1`;
    expect(defaultMockLedger.idempotencyRecords.has(expectedKey)).toBe(true);
  });

  it('runs complete dispute-to-refund path under admin mediation', async () => {
    // 1. Create second deal
    const deal = await safeDealStore.createDeal({
      title: 'MacBook Pro M2 - 16GB',
      description: 'Factory sealed apple laptop',
      price: '750000.00',
      inspectionPeriodSeconds: 20,
      seller: {
        name: 'Seller Two',
        phone: '08099881122',
        email: 'seller2@example.com',
        bankName: 'OPay',
        bankCode: '999992',
        accountNumber: '0123456789',
        accountName: 'OLUWASEUN CHUKWUDI ADENIYI',
      },
    });

    const dealId = deal.id;

    // 2. Buyer checkout & lock escrow
    await safeDealStore.initiateCheckout(dealId, {
      name: 'Buyer Two',
      phone: '08055667788',
    });
    await safeDealStore.lockEscrow(dealId);
    await safeDealStore.dispatchPackage(dealId);
    await safeDealStore.startInspection(dealId);

    // 3. Buyer raises dispute with reason & photo evidence
    const disputeReq = new NextRequest(`http://localhost:3001/api/deals/${dealId}/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'Received older Intel model instead of M2 chip. Counterfeit box.',
        evidencePhotoUrl: '/uploads/evidence_sample.jpg',
      }),
    });
    const disputeRes = await disputeDeal(disputeReq, { params: Promise.resolve({ id: dealId }) });
    const disputeJson = await disputeRes.json();
    expect(disputeJson.data.status).toBe('DISPUTED');
    expect(disputeJson.data.dispute.reason).toContain('Intel model');

    // 4. Verify disputed deal appears in admin mediation desk
    const adminRes = await getAdminDeals();
    const adminJson = await adminRes.json();
    expect(adminJson.data.disputedCount).toBeGreaterThan(0);
    const found = adminJson.data.disputed.find((d: any) => d.id === dealId);
    expect(found).toBeDefined();

    // 5. Admin mediates and issues full refund to buyer bank account
    const refundReq = new NextRequest(`http://localhost:3001/api/deals/${dealId}/refund-buyer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountNumber: '0123456789',
        bankCode: '999992',
        accountName: 'BUYER TWO',
        resolutionNote: 'Evidence verified. Full refund issued.',
      }),
    });
    const refundRes = await refundBuyer(refundReq, { params: Promise.resolve({ id: dealId }) });
    const refundJson = await refundRes.json();
    expect(refundJson.data.status).toBe('REFUNDED');
    expect(refundJson.data.refundPayoutRef).toMatch(/^FP_SD_REF_/);

    // 6. Verify refund idempotency key
    const refundKey = `safedeal_refund_payout_${dealId}_1`;
    expect(defaultMockLedger.idempotencyRecords.has(refundKey)).toBe(true);

    // 7. Test illegal state transition is strictly blocked server-side
    await expect(safeDealStore.dispatchPackage(dealId)).rejects.toThrow(/Illegal state transition/);
  });

  it('handles deal creation and checkout without emails gracefully without collision', async () => {
    // Seller creates deal with NO email
    const req1 = new NextRequest('http://localhost:3001/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'PlayStation 5 Console',
        description: 'New sealed',
        price: '550000',
        seller: {
          name: 'Dayo Ade',
          phone: '08123456789',
          bankName: 'Commercial Bank',
          bankCode: '058',
          accountNumber: '0123456789',
          accountName: 'DAYO ADE',
        },
      }),
    });
    const res1 = await createDeal(req1);
    const json1 = await res1.json();
    expect(json1.status).toBe('success');
    expect(json1.data.seller.email).toBe('seller_08123456789@safedeal.ng');

    // A second seller also creates deal with NO email (different phone)
    const req2 = new NextRequest('http://localhost:3001/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'MacBook Air M2',
        description: 'Used clean',
        price: '850000',
        seller: {
          name: 'Ngozi Eze',
          phone: '08098765432',
          bankName: 'Commercial Bank',
          bankCode: '058',
          accountNumber: '2019283746',
          accountName: 'NGOZI EZE',
        },
      }),
    });
    const res2 = await createDeal(req2);
    const json2 = await res2.json();
    expect(json2.status).toBe('success');
    expect(json2.data.seller.email).toBe('seller_08098765432@safedeal.ng');

    // Buyer checks out with NO email
    const checkoutReq = new NextRequest(`http://localhost:3001/api/deals/${json1.data.id}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Emeka Okafor',
        phone: '07011223344',
      }),
    });
    const checkoutRes = await initiateCheckout(checkoutReq, { params: Promise.resolve({ id: json1.data.id }) });
    const checkoutJson = await checkoutRes.json();
    expect(checkoutJson.status).toBe('success');
    expect(checkoutJson.data.buyer.email).toBe('buyer_07011223344@safedeal.ng');
  });

  it('syncs client-cached deals and recovers missing sessions across lambda recycling', async () => {
    const fakeDeal = {
      id: 'sd_client_cached_test_99',
      title: 'Vintage Vinyl Player',
      description: 'Used turntable',
      price: '55000',
      inspectionPeriodSeconds: 15,
      status: 'WAITING_PAYMENT',
      seller: {
        name: 'Vinyl Collector',
        phone: '08012341234',
        email: 'collector@example.com',
        bankName: 'Guaranty Trust Bank',
        bankCode: '058',
        accountNumber: '9988776655',
        accountName: 'COLLECTOR',
        customerId: 'cus_vinyl',
        walletId: 'wal_vinyl',
        sellerToken: 'stk_vinyl',
      },
      history: [{ status: 'WAITING_PAYMENT', timestamp: new Date().toISOString(), note: 'Created' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const syncReq = new NextRequest('http://localhost:3001/api/deals/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal: fakeDeal }),
    });
    const syncRes = await syncDeal(syncReq);
    const syncJson = await syncRes.json();
    expect(syncJson.status).toBe('success');
    expect(syncJson.data.id).toBe('sd_client_cached_test_99');

    // getDeal can now retrieve the synced deal
    const getRes = await getDeal(new NextRequest('http://localhost:3001/api/deals/sd_client_cached_test_99'), {
      params: Promise.resolve({ id: 'sd_client_cached_test_99' }),
    });
    const getJson = await getRes.json();
    expect(getJson.status).toBe('success');
    expect(getJson.data.title).toBe('Vintage Vinyl Player');
  });
});
