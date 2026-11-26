import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import {
  AjoClubStore,
  AjoMember,
  verifyNameMatch,
  fossaClient,
  defaultMockLedger,
} from '../src/lib/clubStore';
import { toKobo, fromKobo, formatNGN } from '@fossapay/client';

describe('AjoSphere E2E Lifecycle & Defaulter Mitigation Suite', () => {
  let store: AjoClubStore;

  beforeEach(() => {
    store = new AjoClubStore();
  });

  it('validates name matching between KYC identity and bank account name', () => {
    // Exact match
    expect(
      verifyNameMatch('OLUWASEUN CHUKWUDI ADENIYI', 'OLUWASEUN CHUKWUDI ADENIYI')
    ).toBe(true);

    // Permuted / partial token match
    expect(
      verifyNameMatch('OLUWASEUN CHUKWUDI ADENIYI', 'ADENIYI OLUWASEUN')
    ).toBe(true);

    // Completely different identity
    expect(
      verifyNameMatch('OLUWASEUN CHUKWUDI ADENIYI', 'IBRAHIM MUSA')
    ).toBe(false);
  });

  it('rejects joining when KYC name does not match the payout bank account', async () => {
    const club = store.createClub({
      name: 'Integrity Test Ajo',
      contributionAmount: '20000.00',
      totalRounds: 5,
    });

    // BVN resolves to 'TUNDE BALOGUN', but account number '0123456789' belongs to 'OLUWASEUN CHUKWUDI ADENIYI'
    await expect(
      store.joinClub({
        clubId: club.id,
        kycMethod: 'BVN',
        identityNumber: '22233344455', // Resolves to TUNDE BALOGUN
        bankCode: '999992', // OPay
        accountNumber: '0123456789', // Resolves to OLUWASEUN CHUKWUDI ADENIYI
      })
    ).rejects.toThrow(/Identity name mismatch/i);
  });

  it('enforces that full BVN/NIN is never stored in persistent member records', async () => {
    const club = store.createClub({
      name: 'Security Test Ajo',
      contributionAmount: '20000.00',
      totalRounds: 5,
    });

    const rawBVN = '22233344455';
    const res = await store.joinClub({
      clubId: club.id,
      kycMethod: 'BVN',
      identityNumber: rawBVN,
      bankCode: '058', // GTBank
      accountNumber: '9988776655', // TUNDE BALOGUN
    });
    if ('paymentRequired' in res) throw new Error('Unexpected paymentRequired');
    const { member } = res;

    expect(member.name).toBe('TUNDE BALOGUN');
    expect(member.bvnOrNinLast4).toBe('4455');
    expect(member.bvnOrNinHash).toBe(
      crypto.createHash('sha256').update(rawBVN).digest('hex')
    );

    // Verify raw BVN is not present on member object
    const serialized = JSON.stringify(member);
    expect(serialized).not.toContain(rawBVN);
  });

  it('runs a complete 5-member, 5-round simulation including a late contributor in Round 5', async () => {
    // Step 1: Create 5-member club
    const club = store.createClub({
      name: 'Lagos Techies Esusu Club',
      contributionAmount: '20000.00',
      totalRounds: 5,
    });

    expect(club.rounds.length).toBe(5);
    expect(club.rounds[0].targetPotAmount).toBe('100000.00');

    // Step 2: 5 verified members join
    const memberData = [
      {
        bvn: '01234567891', // Resolves to OLUWASEUN CHUKWUDI ADENIYI
        bankCode: '999992',
        accountNumber: '0123456789',
      },
      {
        bvn: '22233344455', // Resolves to TUNDE BALOGUN
        bankCode: '058',
        accountNumber: '9988776655',
      },
      {
        bvn: '11223344556', // Resolves to CHIDINMA OKONKWO
        bankCode: '057',
        accountNumber: '1122334455',
      },
      {
        bvn: '99887766554', // Resolves to IBRAHIM MUSA
        bankCode: '058',
        accountNumber: '5566778899',
      },
      {
        bvn: '12345678900', // Resolves to BABATUNDE ADEYEMI
        bankCode: '058',
        accountNumber: '1234567890',
      },
    ];

    const joinedMembers: AjoMember[] = [];
    for (const data of memberData) {
      const res = await store.joinClub({
        clubId: club.id,
        kycMethod: 'BVN',
        identityNumber: data.bvn,
        bankCode: data.bankCode,
        accountNumber: data.accountNumber,
      });
      if ('paymentRequired' in res) throw new Error('Unexpected paymentRequired');
      joinedMembers.push(res.member);
    }

    expect(club.members.length).toBe(5);
    // Every member has a permanent Providus virtual account starting with 99
    for (const mem of joinedMembers) {
      expect(mem.dedicatedAccountNumber).toMatch(/^99\d{8}$/);
      expect(mem.dedicatedBankName).toBe('Providus Bank');
    }

    // --- Rounds 1 through 4 (Happy Path) ---
    for (let r = 1; r <= 4; r++) {
      expect(club.currentRound).toBe(r);
      const activeRound = club.rounds[r - 1];

      // Monday: All 5 members deposit ₦20,000 to their permanent virtual accounts
      for (const mem of joinedMembers) {
        await store.recordDeposit(
          mem.dedicatedAccountNumber,
          '20000.00',
          `ref_dep_r${r}_${mem.id}`
        );
      }

      expect(activeRound.collectedPotAmount).toBe('100000.00');
      expect(activeRound.status).toBe('POT_FULL');

      // Friday: Advance to disbursal day
      await store.advanceTime(club.id, 'FRIDAY');

      expect(activeRound.status).toBe('DISBURSED');
      expect(activeRound.disbursedAmount).toBe('100000.00');
      expect(activeRound.payoutId).toBeDefined();

      // Advance to next round
      store.advanceRound(club.id);
    }

    // --- Round 5: Late contributor / Defaulter scenario ---
    expect(club.currentRound).toBe(5);
    const round5 = club.rounds[4];
    expect(round5.roundNumber).toBe(5);

    // Only 4 out of 5 members deposit (Member 5 defaults during Mon-Thu window)
    for (let i = 0; i < 4; i++) {
      await store.recordDeposit(
        joinedMembers[i].dedicatedAccountNumber,
        '20000.00',
        `ref_dep_r5_${joinedMembers[i].id}`
      );
    }

    expect(round5.collectedPotAmount).toBe('80000.00');
    expect(round5.status).toBe('WAITING_CONTRIBUTIONS');

    // Friday arrives! Advance time to FRIDAY
    await store.advanceTime(club.id, 'FRIDAY');

    // System detects deficit: Disbursal is HELD, defaulter flagged
    expect(round5.status).toBe('HELD_DEFICIT');
    expect(round5.disbursedAt).toBeUndefined();

    // Verify reminder log triggered for Member 5
    const defaulterAlert = club.reminderLog.find(
      (rem) => rem.memberId === joinedMembers[4].id && rem.roundNumber === 5
    );
    expect(defaulterAlert).toBeDefined();
    expect(defaulterAlert?.message).toContain('URGENT');

    // Verify audit ledger records deficit
    const deficitAudit = club.auditLedger.find((a) => a.type === 'DEFICIT_FLAGGED');
    expect(deficitAudit).toBeDefined();

    // Admin chooses Option A: "Wait for Defaulter"
    await store.resolveDefaulter(club.id, 'wait');
    expect(round5.status).toBe('HELD_DEFICIT');

    // Late deposit lands from Member 5 via their permanent virtual account
    await store.recordDeposit(
      joinedMembers[4].dedicatedAccountNumber,
      '20000.00',
      `ref_dep_r5_late_${joinedMembers[4].id}`
    );

    // Pot is now complete!
    expect(round5.collectedPotAmount).toBe('100000.00');
    expect(round5.status).toBe('POT_FULL');

    // Trigger Friday disbursal
    await store.disburseRound(club.id, 5);

    expect(round5.status).toBe('DISBURSED');
    expect(round5.disbursedAmount).toBe('100000.00');
    expect(round5.payoutId).toBeDefined();

    // Verify payout idempotency: retrying disbursal returns existing payout without double payout
    const retryDisbursal = await store.disburseRound(club.id, 5);
    expect(retryDisbursal.payoutId).toBe(round5.payoutId);

    // Complete the club
    store.advanceRound(club.id);
    expect(club.status).toBe('COMPLETED');
  });

  it('prompts user to make payment when KYC lookup balance is insufficient, then confirms join upon payment', async () => {
    const club = store.createClub({
      name: 'KYC Fee Flow Club',
      contributionAmount: '5000.00',
      totalRounds: 3,
    });

    // Mock verifyIdentity to simulate insufficient balance on first attempt
    const originalVerify = fossaClient.kyc.verifyIdentity;
    let callCount = 0;
    fossaClient.kyc.verifyIdentity = async (method, idNum, key) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Insufficient NGN available balance for KYC verification');
      }
      return originalVerify.call(fossaClient.kyc, method, idNum, key);
    };

    try {
      const joinRes = await store.joinClub({
        clubId: club.id,
        kycMethod: 'BVN',
        identityNumber: '22233344455',
        bankCode: '058',
        accountNumber: '9988776655', // TUNDE BALOGUN
      });

      expect('paymentRequired' in joinRes && joinRes.paymentRequired).toBe(true);
      if (!('paymentRequired' in joinRes) || !joinRes.paymentRequired) return;

      expect(joinRes.fee).toBe('70');
      expect(joinRes.kycMethod).toBe('BVN');
      expect(joinRes.checkout.accountNumber).toBeDefined();

      // Attempting confirm before payment fails
      await expect(store.confirmKycPayment(joinRes.pendingId, false)).rejects.toThrow(/not been confirmed yet/);

      // Simulate payment and confirm
      const confirmRes = await store.confirmKycPayment(joinRes.pendingId, true);
      expect(confirmRes.member.name).toBe('TUNDE BALOGUN');
      expect(confirmRes.member.rotationPosition).toBe(1);
    } finally {
      fossaClient.kyc.verifyIdentity = originalVerify;
    }
  });

  it('returns undefined for unknown clubs and deduplicates concurrent confirmKycPayment calls', async () => {
    expect(store.getClub('ajo_does_not_exist_999')).toBeUndefined();

    const club = store.createClub({
      name: 'Concurrent KYC Club',
      contributionAmount: '500.00',
      totalRounds: 3,
    });

    const originalVerify = fossaClient.kyc.verifyIdentity;
    let verifyCalls = 0;
    const seenKeys = new Set<string>();
    fossaClient.kyc.verifyIdentity = async (method, idNum, key) => {
      verifyCalls++;
      seenKeys.add(key);
      if (verifyCalls === 1) {
        throw new Error('Insufficient NGN available balance for KYC verification');
      }
      await new Promise((r) => setTimeout(r, 20));
      return originalVerify.call(fossaClient.kyc, method, idNum, key);
    };

    try {
      const joinRes = await store.joinClub({
        clubId: club.id,
        kycMethod: 'BVN',
        identityNumber: '22233344455',
        bankCode: '058',
        accountNumber: '9988776655',
      });
      if (!('paymentRequired' in joinRes) || !joinRes.paymentRequired) throw new Error('Expected paymentRequired');

      // Fire two concurrent confirms (e.g. polling + manual button)
      const [r1, r2] = await Promise.all([
        store.confirmKycPayment(joinRes.pendingId, true),
        store.confirmKycPayment(joinRes.pendingId, false),
      ]);
      expect(r1.member.id).toBe(r2.member.id);
      expect(club.members).toHaveLength(1);
      expect(verifyCalls).toBe(2); // 1 initial failed attempt + 1 single confirmed attempt
      expect(seenKeys.has(`ajo_kyc_${joinRes.pendingId}`)).toBe(true);
    } finally {
      fossaClient.kyc.verifyIdentity = originalVerify;
    }
  });
});
