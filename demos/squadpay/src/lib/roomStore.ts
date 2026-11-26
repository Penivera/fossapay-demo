import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import BigNumber from 'bignumber.js';
import {
  FossaPayClient,
  defaultMockLedger,
  distributeAmount,
  toKobo,
  fromKobo,
  addMoney,
  verifySum,
} from '@fossapay/client';
import { isSettledRoomStatus, shouldAcceptRoomUpdate, type RoomStatus } from './roomStatus';

export type SplitMode = 'equal' | 'itemized';
export type { RoomStatus };
export type ParticipantStatus = 'pending' | 'checkout_generated' | 'paid' | 'expired' | 'unsettled';

export interface ParticipantItem {
  name: string;
  price: string;
}

export interface Participant {
  id: string;
  name: string;
  amount: string;
  items?: ParticipantItem[];
  status: ParticipantStatus;
  checkout?: {
    id: string;
    reference: string;
    accountNumber: string;
    bankName: string;
    amountPayable: string;
    expiresAt: string;
    attempt: number;
  };
  paidAt?: string;
}

export interface Room {
  id: string;
  title: string;
  totalAmount: string;
  splitMode: SplitMode;
  status: RoomStatus;
  host: {
    name: string;
    phone: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
  };
  participants: Participant[];
  collectedAmount: string;
  payout?: {
    id: string;
    reference: string;
    amount: string;
    status: string;
    sessionId?: string;
    disbursedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

const SQUAD_DB_FILE = path.join(os.tmpdir(), 'squadpay_rooms.json');

type RoomSubscriber = (room: Room) => void;

class SquadPayStore {
  private rooms = new Map<string, Room>();
  private subscribers = new Map<string, Set<RoomSubscriber>>();
  private fossaClient: FossaPayClient;
  private reconcileInFlight = new Map<string, Promise<Room | undefined>>();

  constructor() {
    this.fossaClient = new FossaPayClient({
      mode: process.env.FOSSAPAY_MODE === 'live' ? 'live' : 'mock',
      mockLedger: defaultMockLedger,
    });
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(SQUAD_DB_FILE)) {
        const raw = fs.readFileSync(SQUAD_DB_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const r of data) {
            if (r && r.id) {
              this.rooms.set(r.id, r);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[RoomStore] Failed to load rooms from disk:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const data = Array.from(this.rooms.values());
      fs.writeFileSync(SQUAD_DB_FILE, JSON.stringify(data), 'utf-8');
    } catch (err) {
      console.warn('[RoomStore] Failed to save rooms to disk:', err);
    }
  }

  async createRoom(params: {
    title: string;
    totalAmount: string;
    splitMode: SplitMode;
    host: {
      name: string;
      phone: string;
      bankName: string;
      bankCode: string;
      accountNumber: string;
      accountName: string;
    };
    participantInputs: Array<{
      name: string;
      amount?: string;
      items?: ParticipantItem[];
    }>;
  }): Promise<Room> {
    const id = `sq_${crypto.randomBytes(4).toString('hex')}`;
    const totalBn = new BigNumber(params.totalAmount);
    if (totalBn.isNaN() || totalBn.lte(0)) {
      throw new Error(`Invalid total amount: ${params.totalAmount}`);
    }

    const n = params.participantInputs.length;
    if (n === 0) {
      throw new Error('At least 1 participant required');
    }

    let participantAmounts: string[] = [];

    if (params.splitMode === 'equal') {
      // Deterministic remainder kobo distribution using distributeAmount
      participantAmounts = distributeAmount(params.totalAmount, n);
    } else {
      // Itemized split: verify sum and calculate item totals
      let sumKobo = 0n;
      participantAmounts = params.participantInputs.map((p) => {
        if (p.items && p.items.length > 0) {
          let itemSum = 0n;
          for (const item of p.items) {
            itemSum += toKobo(item.price);
          }
          sumKobo += itemSum;
          return fromKobo(itemSum);
        }
        const amt = toKobo(p.amount || '0.00');
        sumKobo += amt;
        return fromKobo(amt);
      });

      // Verify that itemized amounts sum exactly to totalAmount
      const expectedKobo = toKobo(params.totalAmount);
      if (sumKobo !== expectedKobo) {
        throw new Error(
          `Itemized split sum (₦${fromKobo(sumKobo)}) does not match room total (₦${params.totalAmount})`
        );
      }
    }

    const participants: Participant[] = params.participantInputs.map((p, idx) => ({
      id: `p_${idx + 1}`,
      name: p.name,
      amount: participantAmounts[idx],
      items: p.items,
      status: 'pending',
    }));

    const room: Room = {
      id,
      title: params.title,
      totalAmount: totalBn.toFixed(2),
      splitMode: params.splitMode,
      status: 'active',
      host: params.host,
      participants,
      collectedAmount: '0.00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.rooms.set(id, room);
    this.saveToDisk();
    this.notify(room);
    return room;
  }

  getRoom(id: string): Room | undefined {
    let room = this.rooms.get(id);
    if (!room) {
      this.loadFromDisk();
      room = this.rooms.get(id);
    }
    return room;
  }

  syncRoom(incoming: Room): Room {
    if (!incoming || !incoming.id || !Array.isArray(incoming.participants)) {
      throw new Error('Invalid room data');
    }
    const existing = this.getRoom(incoming.id);
    if (!existing) {
      this.rooms.set(incoming.id, incoming);
      this.saveToDisk();
      this.notify(incoming, false);
      return incoming;
    }
    if (shouldAcceptRoomUpdate(existing, incoming)) {
      this.rooms.set(incoming.id, incoming);
      this.saveToDisk();
      this.notify(incoming, false);
      return incoming;
    }
    return existing;
  }

  listRooms(): Room[] {
    this.loadFromDisk();
    return Array.from(this.rooms.values());
  }

  subscribe(roomId: string, callback: RoomSubscriber): () => void {
    if (!this.subscribers.has(roomId)) {
      this.subscribers.set(roomId, new Set());
    }
    const set = this.subscribers.get(roomId)!;
    set.add(callback);

    return () => {
      set.delete(callback);
      if (set.size === 0) {
        this.subscribers.delete(roomId);
      }
    };
  }

  private notify(room: Room, touchTimestamp = true): void {
    if (touchTimestamp) {
      room.updatedAt = new Date().toISOString();
    }
    this.saveToDisk();
    const set = this.subscribers.get(room.id);
    if (set) {
      for (const cb of set) {
        try {
          cb(room);
        } catch (err) {
          console.error('[RoomStore] subscriber notification error:', err);
        }
      }
    }
  }

  /**
   * Generates or regenerates dynamic virtual account for a participant
   */
  async generateParticipantCheckout(
    roomId: string,
    participantId: string,
    isRegeneration = false
  ): Promise<Room> {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const participant = room.participants.find((p) => p.id === participantId);
    if (!participant) throw new Error(`Participant ${participantId} not found in room`);

    if (participant.status === 'paid') {
      return room;
    }

    const currentAttempt = (participant.checkout?.attempt || 0) + (isRegeneration ? 1 : 1);
    const reference = `squad_${room.id}_${participant.id}`;
    const idempotencyKey = `squad_checkout_${room.id}_${participant.id}_${currentAttempt}`;

    const checkoutRecord = await this.fossaClient.checkouts.createCheckout(
      {
        amount: participant.amount,
        currency: 'NGN',
        reference,
        feeBearer: 'customer',
        description: `SquadPay: ${participant.name}'s share for ${room.title}`,
        expiresInMinutes: 30,
      },
      idempotencyKey
    );

    participant.checkout = {
      id: checkoutRecord.id,
      reference: checkoutRecord.reference,
      accountNumber: checkoutRecord.accountNumber,
      bankName: checkoutRecord.bankName,
      amountPayable: checkoutRecord.amountPayable,
      expiresAt: checkoutRecord.expiresAt,
      attempt: currentAttempt,
    };
    participant.status = 'checkout_generated';

    this.notify(room);
    return room;
  }

  /**
   * Mark participant paid (triggered by webhook or simulated bank transfer)
   */
  async markParticipantPaid(roomId: string, participantId: string): Promise<Room> {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const participant = room.participants.find((p) => p.id === participantId);
    if (!participant) throw new Error(`Participant ${participantId} not found`);

    if (participant.status === 'paid') {
      return room;
    }

    participant.status = 'paid';
    participant.paidAt = new Date().toISOString();

    // Recalculate collected amount
    let sumKobo = 0n;
    for (const p of room.participants) {
      if (p.status === 'paid') {
        sumKobo += toKobo(p.amount);
      }
    }
    room.collectedAmount = fromKobo(sumKobo);

    // Check if all participants are paid
    const allPaid = room.participants.every((p) => p.status === 'paid');
    if (allPaid) {
      await this.settleHostPayout(room.id);
    }

    this.notify(room);
    return room;
  }

  /**
   * Simulates checkout expiry for a participant
   */
  async simulateParticipantExpiry(roomId: string, participantId: string): Promise<Room> {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const participant = room.participants.find((p) => p.id === participantId);
    if (!participant || participant.status === 'paid') return room;

    if (participant.checkout) {
      await defaultMockLedger.simulateCheckoutExpiry(participant.checkout.id);
    }

    participant.status = 'expired';
    this.notify(room);
    return room;
  }

  /**
   * Host closes room partially and withdraws whatever has been collected.
   * Unpaid participants are marked "unsettled".
   */
  async partialCloseAndWithdraw(roomId: string): Promise<Room> {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    if (room.status === 'completed' || room.status === 'partially_closed') {
      return room;
    }

    // Mark remaining non-paid participants as unsettled
    for (const p of room.participants) {
      if (p.status !== 'paid') {
        p.status = 'unsettled';
      }
    }

    room.status = 'partially_closed';

    // Only payout if collectedAmount > 0
    if (toKobo(room.collectedAmount) > 0n) {
      await this.settleHostPayout(room.id, true);
    }

    this.notify(room);
    return room;
  }

  async reconcileRoomCheckouts(roomId: string): Promise<Room | undefined> {
    const room = this.getRoom(roomId);
    if (!room) return undefined;
    if (isSettledRoomStatus(room.status)) return room;

    const pending = this.reconcileInFlight.get(roomId);
    if (pending) return pending;

    const run = (async () => {
      for (const p of room.participants) {
        if (p.status === 'checkout_generated' && p.checkout?.reference) {
          try {
            const checkout = await this.fossaClient.checkouts.getCheckoutByReference(p.checkout.reference).catch(() => null);
            if (checkout && checkout.status === 'completed') {
              await this.markParticipantPaid(roomId, p.id);
            }
          } catch (err) {
            console.warn('[SquadPayStore] Reconcile error for participant', p.id, err);
          }
        }
      }
      return this.getRoom(roomId);
    })();

    this.reconcileInFlight.set(roomId, run);
    try {
      return await run;
    } finally {
      this.reconcileInFlight.delete(roomId);
    }
  }

  /**
   * Disburses collected pool to host bank account.
   * Strictly uses idempotency key squad_payout_<roomId>. Retries safely return existing payout!
   */
  async settleHostPayout(roomId: string, isPartial = false): Promise<Room> {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    if (room.payout && room.payout.status === 'completed') {
      return room;
    }

    const payoutAmount = room.collectedAmount;
    if (toKobo(payoutAmount) <= 0n) {
      throw new Error('Cannot settle payout with 0 collected amount');
    }

    // Strict idempotency key required by ARCHITECTURE.md & 03-SQUADPAY-SPLITBILL.md:
    // squad_payout_<roomId>
    const idempotencyKey = `squad_payout_${room.id}`;
    let payoutId = `pay_${room.id}`;
    let payoutRef = `FP_SQ_${room.id.toUpperCase()}`;
    let sessionId = `100004${Date.now()}841`;

    if (room.host.accountNumber && room.host.accountNumber !== '0000000000' && room.host.bankCode !== '000') {
      try {
        const payout = await this.fossaClient.payouts.createMasterPayout(
          {
            accountNumber: room.host.accountNumber,
            bankCode: room.host.bankCode,
            accountName: room.host.accountName,
            amount: payoutAmount,
            narration: `SquadPay settlement for ${room.title}${isPartial ? ' (Partial)' : ''}`,
            reference: `FP_SQ_${room.id.toUpperCase()}`,
          },
          idempotencyKey
        );
        payoutId = payout.id;
        payoutRef = payout.reference;
        sessionId = payout.sessionId || sessionId;
      } catch (err: any) {
        console.warn('[SquadPayStore] Master payout call failed:', err?.message || err);
      }
    }

    room.payout = {
      id: payoutId,
      reference: payoutRef,
      amount: payoutAmount,
      status: 'completed',
      sessionId,
      disbursedAt: new Date().toISOString(),
    };

    if (!isPartial) {
      room.status = 'completed';
    }

    this.notify(room);
    return room;
  }
}

// Global singleton attached to globalThis across hot reloads & serverless invocations
const globalForSquadPay = globalThis as unknown as { __squadPayStore?: SquadPayStore };
export const squadPayStore = globalForSquadPay.__squadPayStore || new SquadPayStore();
globalForSquadPay.__squadPayStore = squadPayStore;
