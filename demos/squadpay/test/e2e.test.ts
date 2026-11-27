import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { defaultMockLedger } from '@fossapay/client';
import { POST as createRoom } from '../src/app/api/rooms/route';
import { GET as getRoom } from '../src/app/api/rooms/[id]/route';
import { GET as streamRoom } from '../src/app/api/rooms/[id]/stream/route';
import { POST as generateCheckout } from '../src/app/api/rooms/[id]/checkout/route';
import { POST as regenerateCheckout } from '../src/app/api/rooms/[id]/regenerate/route';
import { POST as simulatePayment } from '../src/app/api/rooms/[id]/simulate-payment/route';
import { POST as simulateExpiry } from '../src/app/api/rooms/[id]/simulate-expiry/route';
import { POST as partialWithdraw } from '../src/app/api/rooms/[id]/partial-withdraw/route';
import { squadPayStore } from '../src/lib/roomStore';
import { shouldAcceptRoomUpdate } from '../src/lib/roomStatus';

describe('SquadPay Bill Splitting & Settlement E2E Suite', () => {
  it('handles 3 participants paying, live updates over SSE, single idempotent host payout', async () => {
    // 1. Create Room: ₦60,000 split equally among 3 friends (₦20,000 each)
    const createReq = new NextRequest('http://localhost:3002/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Dinner at Cactus',
        totalAmount: '60000.00',
        splitMode: 'equal',
        host: {
          name: 'Tunde Balogun',
          phone: '08099887766',
          bankName: 'Guaranty Trust Bank',
          bankCode: '058',
          accountNumber: '9988776655',
          accountName: 'TUNDE BALOGUN',
        },
        participantInputs: [
          { name: 'Friend A' },
          { name: 'Friend B' },
          { name: 'Friend C' },
        ],
      }),
    });
    const createRes = await createRoom(createReq);
    const createJson = await createRes.json();
    expect(createJson.status).toBe('success');
    const roomId = createJson.data.id;
    expect(createJson.data.participants).toHaveLength(3);
    expect(createJson.data.participants[0].amount).toBe('20000.00');

    // 2. Connect to SSE Stream
    const streamReq = new NextRequest(`http://localhost:3002/api/rooms/${roomId}/stream`);
    const streamRes = await streamRoom(streamReq, { params: Promise.resolve({ id: roomId }) });
    expect(streamRes.headers.get('Content-Type')).toBe('text/event-stream');

    // 3. Friend A generates checkout and pays
    const payA = await simulatePayment(
      new NextRequest(`http://localhost:3002/api/rooms/${roomId}/simulate-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: 'p_1' }),
      }),
      { params: Promise.resolve({ id: roomId }) }
    );
    const payAJson = await payA.json();
    expect(payAJson.data.participants[0].status).toBe('paid');
    expect(payAJson.data.collectedAmount).toBe('20000.00');
    expect(payAJson.data.status).toBe('active'); // Not all paid yet

    // 4. Friend B generates checkout and pays
    const payB = await simulatePayment(
      new NextRequest(`http://localhost:3002/api/rooms/${roomId}/simulate-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: 'p_2' }),
      }),
      { params: Promise.resolve({ id: roomId }) }
    );
    const payBJson = await payB.json();
    expect(payBJson.data.participants[1].status).toBe('paid');
    expect(payBJson.data.collectedAmount).toBe('40000.00');
    expect(payBJson.data.status).toBe('active');

    // 5. Friend C pays -> All 3 paid -> Triggers automatic host payout!
    const payC = await simulatePayment(
      new NextRequest(`http://localhost:3002/api/rooms/${roomId}/simulate-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: 'p_3' }),
      }),
      { params: Promise.resolve({ id: roomId }) }
    );
    const payCJson = await payC.json();
    expect(payCJson.data.participants[2].status).toBe('paid');
    expect(payCJson.data.collectedAmount).toBe('60000.00');
    expect(payCJson.data.status).toBe('completed');
    expect(payCJson.data.payout).toBeDefined();
    expect(payCJson.data.payout.amount).toBe('60000.00');
    expect(payCJson.data.payout.reference).toMatch(/^FP_SQ_/);

    // 6. Verify single payout in mock ledger with exact key: squad_payout_<roomId>
    const expectedKey = `squad_payout_${roomId}`;
    expect(defaultMockLedger.idempotencyRecords.has(expectedKey)).toBe(true);

    // 7. Retrying the completion trigger must NOT duplicate the payout!
    const initialPayoutSize = defaultMockLedger.payouts.size;
    await squadPayStore.settleHostPayout(roomId);
    expect(defaultMockLedger.payouts.size).toBe(initialPayoutSize);
  });

  it('handles checkout expiry and account regeneration', async () => {
    const room = await squadPayStore.createRoom({
      title: 'Lunch Split',
      totalAmount: '30000.00',
      splitMode: 'equal',
      host: {
        name: 'Tunde Balogun',
        phone: '08099887766',
        bankName: 'OPay',
        bankCode: '999992',
        accountNumber: '0123456789',
        accountName: 'OLUWASEUN CHUKWUDI ADENIYI',
      },
      participantInputs: [{ name: 'Friend 1' }, { name: 'Friend 2' }],
    });

    // Generate checkout
    await squadPayStore.generateParticipantCheckout(room.id, 'p_1');
    const p1 = room.participants[0];
    expect(p1.status).toBe('checkout_generated');
    const firstAcct = p1.checkout?.accountNumber;

    // Simulate 30-min timeout / expiry
    await squadPayStore.simulateParticipantExpiry(room.id, 'p_1');
    expect(p1.status).toBe('expired');

    // Click "Regenerate Account"
    const regenReq = new NextRequest(`http://localhost:3002/api/rooms/${room.id}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: 'p_1' }),
    });
    const regenRes = await regenerateCheckout(regenReq, { params: Promise.resolve({ id: room.id }) });
    const regenJson = await regenRes.json();
    expect(regenJson.data.participants[0].status).toBe('checkout_generated');
    expect(regenJson.data.participants[0].checkout.attempt).toBe(2);
  });

  it('handles partial close and withdraw with unsettled marking', async () => {
    const room = await squadPayStore.createRoom({
      title: 'Night Out',
      totalAmount: '50000.00',
      splitMode: 'equal',
      host: {
        name: 'Tunde Balogun',
        phone: '08099887766',
        bankName: 'OPay',
        bankCode: '999992',
        accountNumber: '0123456789',
        accountName: 'OLUWASEUN CHUKWUDI ADENIYI',
      },
      participantInputs: [{ name: 'Friend A' }, { name: 'Friend B' }],
    });

    // Friend A pays ₦25,000, Friend B does not pay
    await squadPayStore.markParticipantPaid(room.id, 'p_1');
    expect(room.collectedAmount).toBe('25000.00');

    // Host clicks "Close Room & Withdraw Partial Pool"
    const withdrawReq = new NextRequest(`http://localhost:3002/api/rooms/${room.id}/partial-withdraw`, {
      method: 'POST',
    });
    const withdrawRes = await partialWithdraw(withdrawReq, { params: Promise.resolve({ id: room.id }) });
    const withdrawJson = await withdrawRes.json();

    expect(withdrawJson.data.status).toBe('partially_closed');
    expect(withdrawJson.data.participants[1].status).toBe('unsettled');
    expect(withdrawJson.data.payout.amount).toBe('25000.00');
  });

  it('returns 404 for unknown rooms and never regresses settled rooms via syncRoom', async () => {
    const missingRes = await getRoom(new NextRequest('http://localhost:3002/api/rooms/sq_does_not_exist_999'), {
      params: Promise.resolve({ id: 'sq_does_not_exist_999' }),
    });
    expect(missingRes.status).toBe(404);

    const room = await squadPayStore.createRoom({
      title: 'Monotonic Room',
      totalAmount: '1000.00',
      splitMode: 'equal',
      host: {
        name: 'Tunde Balogun',
        phone: '08099887766',
        bankName: 'GTBank',
        bankCode: '058',
        accountNumber: '9988776655',
        accountName: 'TUNDE BALOGUN',
      },
      participantInputs: [{ name: 'A' }, { name: 'B' }],
    });
    const initialSnapshot = structuredClone(room);
    await squadPayStore.markParticipantPaid(room.id, 'p_1');
    const settled = await squadPayStore.markParticipantPaid(room.id, 'p_2');
    expect(settled.status).toBe('completed');

    const stale = { ...initialSnapshot, updatedAt: new Date(Date.now() + 60_000).toISOString() };
    expect(shouldAcceptRoomUpdate(settled, stale)).toBe(false);
    const synced = squadPayStore.syncRoom(stale);
    expect(synced.status).toBe('completed');
  });

  it('skips reconciliation on plain GET and scopes ?reconcile=1 to participantId when provided', async () => {
    const room = await squadPayStore.createRoom({
      title: 'Explicit Reconcile Split',
      totalAmount: '2000.00',
      splitMode: 'equal',
      host: {
        name: 'Tunde Balogun',
        phone: '08099887766',
        bankName: 'GTBank',
        bankCode: '058',
        accountNumber: '9988776655',
        accountName: 'TUNDE BALOGUN',
      },
      participantInputs: [{ name: 'Alice' }, { name: 'Bob' }],
    });

    await squadPayStore.generateParticipantCheckout(room.id, 'p_1');
    const generated = await squadPayStore.generateParticipantCheckout(room.id, 'p_2');
    const p1CheckoutId = generated.participants[0].checkout!.id;
    const p2CheckoutId = generated.participants[1].checkout!.id;

    await defaultMockLedger.simulateCheckoutPayment(p1CheckoutId);
    await defaultMockLedger.simulateCheckoutPayment(p2CheckoutId);

    // Plain GET must not reconcile upstream checkouts
    const plainRes = await getRoom(new NextRequest(`http://localhost:3002/api/rooms/${room.id}`), {
      params: Promise.resolve({ id: room.id }),
    });
    const plainJson = await plainRes.json();
    expect(plainJson.status).toBe('success');
    expect(plainJson.data.participants[0].status).toBe('checkout_generated');
    expect(plainJson.data.participants[1].status).toBe('checkout_generated');

    // ?reconcile=1&participantId=p_1 reconciles only p_1
    const scopedRes = await getRoom(
      new NextRequest(`http://localhost:3002/api/rooms/${room.id}?reconcile=1&participantId=p_1`),
      { params: Promise.resolve({ id: room.id }) }
    );
    const scopedJson = await scopedRes.json();
    expect(scopedJson.data.participants[0].status).toBe('paid');
    expect(scopedJson.data.participants[1].status).toBe('checkout_generated');

    // ?reconcile=1 without participantId reconciles remaining open checkouts
    const fullRes = await getRoom(
      new NextRequest(`http://localhost:3002/api/rooms/${room.id}?reconcile=1`),
      { params: Promise.resolve({ id: room.id }) }
    );
    const fullJson = await fullRes.json();
    expect(fullJson.data.participants[1].status).toBe('paid');
    expect(fullJson.data.status).toBe('completed');
  });
});
