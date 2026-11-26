import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  FossaPayClient,
  toKobo,
  fromKobo,
  formatNGN,
  addMoney,
  defaultMockLedger,
} from '@fossapay/client';

export { defaultMockLedger };

export type SimulatedDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY';

export interface AjoMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  // Security rule: Never store or log full BVN/NIN. Only SHA-256 hash and last 4 digits.
  bvnOrNinHash: string;
  bvnOrNinLast4: string;
  payoutBankCode: string;
  payoutBankName: string;
  payoutAccountNumber: string;
  payoutAccountName: string;
  // Permanent dedicated virtual account
  dedicatedAccountNumber: string;
  dedicatedBankName: string;
  dedicatedBankCode: string;
  fossaCustomerId: string;
  fossaWalletId: string;
  rotationPosition: number; // 1 to totalRounds
  joinedAt: string;
}

export interface AjoContribution {
  memberId: string;
  memberName: string;
  amount: string;
  paidAt: string;
  depositRef: string;
}

export interface AjoRound {
  roundNumber: number;
  recipientMemberId: string;
  recipientName: string;
  targetPotAmount: string;
  collectedPotAmount: string;
  contributions: AjoContribution[];
  status: 'WAITING_CONTRIBUTIONS' | 'POT_FULL' | 'HELD_DEFICIT' | 'DISBURSED' | 'DISBURSED_PARTIAL';
  payoutId?: string;
  payoutTxHash?: string;
  payoutError?: string;
  disbursedAt?: string;
  disbursedAmount?: string;
}

export interface AjoAuditEntry {
  id: string;
  timestamp: string;
  type: 'CLUB_CREATED' | 'MEMBER_JOINED' | 'CONTRIBUTION_RECEIVED' | 'DEFICIT_FLAGGED' | 'POT_DISBURSED' | 'ADMIN_OVERRIDE';
  description: string;
  meta?: Record<string, unknown>;
}

export interface AjoReminderEntry {
  id: string;
  timestamp: string;
  memberId: string;
  memberName: string;
  phone: string;
  roundNumber: number;
  channel: 'SMS' | 'EMAIL';
  message: string;
}

export interface AjoClub {
  id: string;
  name: string;
  contributionAmount: string; // e.g. "20000.00"
  totalRounds: number; // e.g. 5
  currentRound: number; // 1 to totalRounds
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
  simulatedDay: SimulatedDay;
  adminMemberId?: string;
  members: AjoMember[];
  rounds: AjoRound[];
  auditLedger: AjoAuditEntry[];
  reminderLog: AjoReminderEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface PendingKycVerification {
  id: string;
  clubId: string;
  kycMethod: 'BVN' | 'NIN';
  identityNumber: string;
  accountNumber: string;
  bankCode: string;
  email?: string;
  phone?: string;
  checkoutId: string;
  checkout: any;
  fee: string;
  accountName: string;
  createdAt: string;
}

export type JoinClubResult =
  | { member: AjoMember; club: AjoClub; paymentRequired?: false }
  | {
      paymentRequired: true;
      pendingId: string;
      fee: string;
      kycMethod: 'BVN' | 'NIN';
      accountName: string;
      checkout: {
        id: string;
        accountNumber: string;
        bankName: string;
        accountName: string;
        amount: string;
        fee: string;
        amountPayable: string;
        expiresAt: string;
      };
    };

// Global FossaPay client singleton
export const fossaClient = new FossaPayClient({
  mode: (process.env.FOSSAPAY_MODE as 'mock' | 'live') || 'mock',
  apiKey: process.env.FOSSAPAY_API_KEY || 'fossa_mock_key',
});

// Name matching helper
export function verifyNameMatch(kycName: string, bankAccountName: string): boolean {
  const normalize = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);

  const kycTokens = normalize(kycName);
  const bankTokens = normalize(bankAccountName);

  if (kycTokens.length === 0 || bankTokens.length === 0) return false;

  const matches = kycTokens.filter((token) => bankTokens.includes(token));
  return matches.length >= 2 || (matches.length >= 1 && (kycTokens.length === 1 || bankTokens.length === 1));
}

const AJO_DB_FILE = path.join(os.tmpdir(), 'ajosphere_clubs.json');
const AJO_PENDING_KYC_FILE = path.join(os.tmpdir(), 'ajosphere_pending_kyc.json');

// In-memory persistent store surviving hot-reloads
export class AjoClubStore {
  private clubs = new Map<string, AjoClub>();
  private accountToClubMap = new Map<string, { clubId: string; memberId: string }>();
  private listeners = new Map<string, Set<(club: AjoClub) => void>>();
  private pendingKycVerifications = new Map<string, PendingKycVerification>();
  private confirmInFlight = new Map<string, Promise<{ member: AjoMember; club: AjoClub }>>();

  constructor() {
    this.loadFromDisk();
    if (!this.clubs.has('techies_ajo_2026')) this.seedDemoClub();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(AJO_DB_FILE)) {
        const raw = fs.readFileSync(AJO_DB_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const c of data) {
            if (c && c.id) {
              this.clubs.set(c.id, c);
              for (const m of c.members || []) {
                if (m.dedicatedAccountNumber) {
                  this.accountToClubMap.set(m.dedicatedAccountNumber, { clubId: c.id, memberId: m.id });
                }
              }
            }
          }
        }
      }
      if (fs.existsSync(AJO_PENDING_KYC_FILE)) {
        const raw = fs.readFileSync(AJO_PENDING_KYC_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const p of data) {
            if (p && p.id) {
              this.pendingKycVerifications.set(p.id, p);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[AjoStore] Failed to load from disk:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const data = Array.from(this.clubs.values());
      fs.writeFileSync(AJO_DB_FILE, JSON.stringify(data), 'utf-8');
      const pendingData = Array.from(this.pendingKycVerifications.values());
      fs.writeFileSync(AJO_PENDING_KYC_FILE, JSON.stringify(pendingData), 'utf-8');
    } catch (err) {
      console.warn('[AjoStore] Failed to save to disk:', err);
    }
  }

  private seedDemoClub(): void {
    // If no clubs, create a default "Techies Ajo" club with 4 pre-joined members to make the 5th joinable immediately
    const demoId = 'techies_ajo_2026';
    if (this.clubs.has(demoId)) return;

    const contribution = '20000.00';
    const totalRounds = 5;

    const preJoinedMembers: AjoMember[] = [
      {
        id: 'mem_1',
        name: 'OLUWASEUN CHUKWUDI ADENIYI',
        email: 'seun.adeniyi@example.com',
        phone: '08012345678',
        bvnOrNinHash: crypto.createHash('sha256').update('12345678901').digest('hex'),
        bvnOrNinLast4: '8901',
        payoutBankCode: '999992',
        payoutBankName: 'OPay',
        payoutAccountNumber: '0123456789',
        payoutAccountName: 'OLUWASEUN CHUKWUDI ADENIYI',
        dedicatedAccountNumber: '9910001001',
        dedicatedBankName: 'Providus Bank',
        dedicatedBankCode: '101',
        fossaCustomerId: 'cust_seed_1',
        fossaWalletId: 'wlt_seed_1',
        rotationPosition: 1,
        joinedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: 'mem_2',
        name: 'TUNDE BALOGUN',
        email: 'tunde.balogun@example.com',
        phone: '08022334455',
        bvnOrNinHash: crypto.createHash('sha256').update('22233344455').digest('hex'),
        bvnOrNinLast4: '4455',
        payoutBankCode: '058',
        payoutBankName: 'Guaranty Trust Bank',
        payoutAccountNumber: '9988776655',
        payoutAccountName: 'TUNDE BALOGUN',
        dedicatedAccountNumber: '9910001002',
        dedicatedBankName: 'Providus Bank',
        dedicatedBankCode: '101',
        fossaCustomerId: 'cust_seed_2',
        fossaWalletId: 'wlt_seed_2',
        rotationPosition: 2,
        joinedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      },
      {
        id: 'mem_3',
        name: 'CHIDINMA OKONKWO',
        email: 'chidinma.okonkwo@example.com',
        phone: '08033445566',
        bvnOrNinHash: crypto.createHash('sha256').update('11223344556').digest('hex'),
        bvnOrNinLast4: '4556',
        payoutBankCode: '035',
        payoutBankName: 'Wema Bank',
        payoutAccountNumber: '5544332211',
        payoutAccountName: 'CHIDINMA OKONKWO',
        dedicatedAccountNumber: '9910001003',
        dedicatedBankName: 'Providus Bank',
        dedicatedBankCode: '101',
        fossaCustomerId: 'cust_seed_3',
        fossaWalletId: 'wlt_seed_3',
        rotationPosition: 3,
        joinedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: 'mem_4',
        name: 'IBRAHIM MUSA',
        email: 'ibrahim.musa@example.com',
        phone: '08044556677',
        bvnOrNinHash: crypto.createHash('sha256').update('99887766554').digest('hex'),
        bvnOrNinLast4: '6554',
        payoutBankCode: '057',
        payoutBankName: 'Zenith Bank',
        payoutAccountNumber: '1122334455',
        payoutAccountName: 'IBRAHIM MUSA',
        dedicatedAccountNumber: '9910001004',
        dedicatedBankName: 'Providus Bank',
        dedicatedBankCode: '101',
        fossaCustomerId: 'cust_seed_4',
        fossaWalletId: 'wlt_seed_4',
        rotationPosition: 4,
        joinedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
      },
    ];

    for (const mem of preJoinedMembers) {
      this.accountToClubMap.set(mem.dedicatedAccountNumber, { clubId: demoId, memberId: mem.id });
    }

    const rounds: AjoRound[] = [];
    for (let r = 1; r <= totalRounds; r++) {
      const recipient = preJoinedMembers[r - 1];
      rounds.push({
        roundNumber: r,
        recipientMemberId: recipient ? recipient.id : '',
        recipientName: recipient ? recipient.name : `Round ${r} Recipient (TBD)`,
        targetPotAmount: fromKobo(toKobo(contribution) * BigInt(totalRounds)),
        collectedPotAmount: '0.00',
        contributions: [],
        status: 'WAITING_CONTRIBUTIONS',
      });
    }

    const club: AjoClub = {
      id: demoId,
      name: 'Techies Ajo Club',
      contributionAmount: contribution,
      totalRounds,
      currentRound: 1,
      status: 'ACTIVE',
      simulatedDay: 'MONDAY',
      adminMemberId: preJoinedMembers[0].id,
      members: preJoinedMembers,
      rounds,
      auditLedger: [
        {
          id: `aud_${Date.now()}_init`,
          timestamp: new Date().toISOString(),
          type: 'CLUB_CREATED',
          description: `Club "Techies Ajo Club" created with ${formatNGN(contribution)} weekly contribution across ${totalRounds} rounds.`,
        },
      ],
      reminderLog: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.clubs.set(demoId, club);
  }

  getClub(id: string): AjoClub | undefined {
    let club = this.clubs.get(id);
    if (!club) {
      this.loadFromDisk();
      club = this.clubs.get(id);
    }
    return club;
  }

  listClubs(): AjoClub[] {
    this.loadFromDisk();
    return Array.from(this.clubs.values());
  }

  createClub(params: { name: string; contributionAmount: string; totalRounds?: number }): AjoClub {
    const id = `ajo_${crypto.randomBytes(4).toString('hex')}`;
    const totalRounds = params.totalRounds || 5;
    const contributionAmount = fromKobo(toKobo(params.contributionAmount));

    const rounds: AjoRound[] = [];
    for (let r = 1; r <= totalRounds; r++) {
      rounds.push({
        roundNumber: r,
        recipientMemberId: '',
        recipientName: `Round ${r} Recipient (TBD)`,
        targetPotAmount: fromKobo(toKobo(contributionAmount) * BigInt(totalRounds)),
        collectedPotAmount: '0.00',
        contributions: [],
        status: 'WAITING_CONTRIBUTIONS',
      });
    }

    const club: AjoClub = {
      id,
      name: params.name.trim(),
      contributionAmount,
      totalRounds,
      currentRound: 1,
      status: 'ACTIVE',
      simulatedDay: 'MONDAY',
      members: [],
      rounds,
      auditLedger: [
        {
          id: `aud_${Date.now()}_create`,
          timestamp: new Date().toISOString(),
          type: 'CLUB_CREATED',
          description: `Club "${params.name}" formed with ${formatNGN(contributionAmount)} contribution across ${totalRounds} rotation rounds.`,
        },
      ],
      reminderLog: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.clubs.set(id, club);
    this.saveToDisk();
    this.broadcast(id);
    return club;
  }

  async joinClub(params: {
    clubId: string;
    kycMethod: 'BVN' | 'NIN';
    identityNumber: string;
    accountNumber: string;
    bankCode: string;
    accountName?: string;
    bankName?: string;
    email?: string;
    phone?: string;
    kycIdempotencyKey?: string;
  }): Promise<JoinClubResult> {
    const club = this.getClub(params.clubId);
    if (!club) {
      throw new Error(`Club ${params.clubId} not found`);
    }

    const cleanNum = params.identityNumber.replace(/\D/g, '');
    if (cleanNum.length !== 11) {
      throw new Error(`Invalid ${params.kycMethod}: must be exactly 11 digits`);
    }

    // Never log full BVN/NIN in console or persistent records
    const bvnOrNinHash = crypto.createHash('sha256').update(cleanNum).digest('hex');
    const bvnOrNinLast4 = cleanNum.slice(-4);

    const existingMember = club.members.find((m) => m.bvnOrNinHash === bvnOrNinHash);
    if (existingMember) {
      return { member: existingMember, club };
    }

    if (club.members.length >= club.totalRounds) {
      throw new Error(`Club is full (${club.members.length}/${club.totalRounds} members joined)`);
    }

    // 1. Verify KYC identity via FossaPay KYC endpoint
    let kycResult;
    try {
      const kycIdempotencyKey = params.kycIdempotencyKey || `ajo_kyc_${club.id}_${bvnOrNinLast4}_${Date.now()}`;
      kycResult = await fossaClient.kyc.verifyIdentity(
        params.kycMethod,
        cleanNum,
        kycIdempotencyKey
      );
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      const isBalanceError =
        msg.includes('insufficient ngn available balance') ||
        (msg.includes('insufficient') && msg.includes('balance'));

      if (isBalanceError) {
        // Master wallet has insufficient balance for KYC lookup.
        // Resolve the payout account name so the user sees who they are verifying for.
        let accountName = params.accountName || 'Payout Account';
        try {
          const bankEnquiry = await fossaClient.transfers.bankEnquiry(params.accountNumber, params.bankCode);
          if (bankEnquiry?.accountName) accountName = bankEnquiry.accountName;
        } catch {
          // Fall back to params.accountName
        }

        const fee = params.kycMethod === 'NIN' ? '120' : '70';
        const idempotencyKey = `ajo_kyc_chk_${club.id}_${bvnOrNinLast4}_${Date.now()}`;
        const checkout = await fossaClient.checkouts.createCheckout(
          {
            amount: fee,
            currency: 'NGN',
            description: `AjoSphere identity verification fee (${params.kycMethod})`,
            feeBearer: 'customer',
          },
          idempotencyKey
        );

        const pendingId = `pnd_${crypto.randomBytes(6).toString('hex')}`;
        this.pendingKycVerifications.set(pendingId, {
          id: pendingId,
          clubId: club.id,
          kycMethod: params.kycMethod,
          identityNumber: cleanNum,
          accountNumber: params.accountNumber,
          bankCode: params.bankCode,
          email: params.email,
          phone: params.phone,
          checkoutId: checkout.id,
          checkout,
          fee,
          accountName,
          createdAt: new Date().toISOString(),
        });
        this.saveToDisk();

        return {
          paymentRequired: true,
          pendingId,
          fee,
          kycMethod: params.kycMethod,
          accountName,
          checkout: {
            id: checkout.id,
            accountNumber: checkout.accountNumber,
            bankName: checkout.bankName,
            accountName: checkout.accountName,
            amount: fee,
            fee: checkout.fee || '100.00',
            amountPayable: checkout.amountPayable || fee,
            expiresAt: checkout.expiresAt,
          },
        };
      }

      throw err;
    }

    if (!kycResult.verified) {
      throw new Error(`KYC Verification Failed: Provided ${params.kycMethod} could not be verified`);
    }

    // 2. Perform bank enquiry on member's designated payout account
    const bankEnquiry = await fossaClient.transfers.bankEnquiry(params.accountNumber, params.bankCode);

    // 3. Strict legal name matching: verified KYC identity must match payout account holder
    const isMatch = verifyNameMatch(kycResult.fullName, bankEnquiry.accountName);
    if (!isMatch) {
      throw new Error(
        `Identity name mismatch: KYC record name "${kycResult.fullName}" does not match payout bank account holder "${bankEnquiry.accountName}". Both must belong to the same verified individual.`
      );
    }

    // 4. Create customer record in FossaPay
    const firstName = (kycResult.firstName || kycResult.fullName.split(' ')[0]).replace(/\s+/g, '') || 'Member';
    const lastName = (kycResult.lastName || kycResult.fullName.split(' ').slice(-1)[0]).replace(/\s+/g, '') || 'Ajo';
    const customerEmail = params.email?.trim() || `member_${bvnOrNinHash.slice(0, 10)}@ajosphere.ng`;
    const customerPhone = params.phone || kycResult.phone || `080${bvnOrNinLast4}${bvnOrNinHash.slice(0, 4)}`;

    let customer;
    try {
      customer = await fossaClient.customers.create({
        email: customerEmail,
        phoneNumber: customerPhone,
        firstName,
        lastName,
        dateOfBirth: '1992-06-15',
        address: 'Broad Street',
        city: 'Lagos',
        country: 'Nigeria',
        metadata: {
          clubId: club.id,
          bvnOrNinLast4,
        },
      });
    } catch (err: any) {
      if (err?.message && err.message.toLowerCase().includes('already exists')) {
        const list = await fossaClient.customers.list({ limit: 100 });
        const match = list.find(
          (c) =>
            (c.email && c.email.toLowerCase() === customerEmail.toLowerCase()) ||
            (c.phoneNumber && c.phoneNumber.replace(/\D/g, '') === customerPhone.replace(/\D/g, ''))
        );
        if (match) {
          customer = match;
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    // 5. Provision permanent dedicated NUBAN virtual account
    const fiatWallet = await fossaClient.wallets.createFiatWallet({
      customerId: customer.id,
      currency: 'NGN',
      accountType: 'dedicated',
    });

    const rotationPosition = club.members.length + 1;
    const member: AjoMember = {
      id: `mem_${crypto.randomBytes(4).toString('hex')}`,
      name: kycResult.fullName,
      email: customer.email || `ajo.${bvnOrNinLast4}@example.com`,
      phone: customer.phoneNumber || `080${cleanNum.slice(-8)}`,
      bvnOrNinHash,
      bvnOrNinLast4,
      payoutBankCode: params.bankCode,
      payoutBankName: bankEnquiry.bankName || 'Commercial Bank',
      payoutAccountNumber: params.accountNumber,
      payoutAccountName: bankEnquiry.accountName,
      dedicatedAccountNumber: fiatWallet.accountNumber,
      dedicatedBankName: fiatWallet.bankName,
      dedicatedBankCode: fiatWallet.bankCode,
      fossaCustomerId: customer.id,
      fossaWalletId: fiatWallet.id,
      rotationPosition,
      joinedAt: new Date().toISOString(),
    };

    club.members.push(member);
    this.accountToClubMap.set(member.dedicatedAccountNumber, { clubId: club.id, memberId: member.id });

    // Assign round recipient if round slot matches
    const roundIdx = rotationPosition - 1;
    if (club.rounds[roundIdx]) {
      club.rounds[roundIdx].recipientMemberId = member.id;
      club.rounds[roundIdx].recipientName = member.name;
    }

    // Audit log
    club.auditLedger.push({
      id: `aud_${Date.now()}_join`,
      timestamp: new Date().toISOString(),
      type: 'MEMBER_JOINED',
      description: `Member ${member.name} joined as Position #${rotationPosition}. Dedicated virtual account ${member.dedicatedAccountNumber} (${member.dedicatedBankName}) assigned.`,
      meta: {
        memberId: member.id,
        rotationPosition,
        bvnOrNinLast4,
      },
    });

    club.updatedAt = new Date().toISOString();
    this.saveToDisk();
    this.broadcast(club.id);

    return { member, club };
  }

  async confirmKycPayment(pendingId: string, simulate = false): Promise<{ member: AjoMember; club: AjoClub }> {
    const existingInFlight = this.confirmInFlight.get(pendingId);
    if (existingInFlight) return existingInFlight;

    const run = (async () => {
      let pending = this.pendingKycVerifications.get(pendingId);
      if (!pending) {
        this.loadFromDisk();
        pending = this.pendingKycVerifications.get(pendingId);
      }
      if (!pending) {
        throw new Error('Verification request not found or has expired. Please try joining again.');
      }

      if (simulate && process.env.FOSSAPAY_MODE !== 'live') {
        await defaultMockLedger.simulateCheckoutPayment(pending.checkoutId);
      }

      const chk = await fossaClient.checkouts.getCheckout(pending.checkoutId);
      if (chk.status !== 'completed') {
        throw new Error(
          `Payment of ₦${pending.checkout.amountPayable || pending.fee} to ${pending.checkout.bankName} (${pending.checkout.accountNumber}) has not been confirmed yet. Please complete the transfer and try again.`
        );
      }

      // Now that checkout was paid, master wallet has the funds. Use deterministic idempotency key per pendingId.
      const res = await this.joinClub({
        clubId: pending.clubId,
        kycMethod: pending.kycMethod,
        identityNumber: pending.identityNumber,
        accountNumber: pending.accountNumber,
        bankCode: pending.bankCode,
        email: pending.email,
        phone: pending.phone,
        kycIdempotencyKey: `ajo_kyc_${pendingId}`,
      });

      if ('paymentRequired' in res && res.paymentRequired) {
        throw new Error('Payment received, but wallet balance is still synchronizing. Please try again in a few seconds.');
      }

      this.pendingKycVerifications.delete(pendingId);
      this.saveToDisk();
      return res as { member: AjoMember; club: AjoClub };
    })();

    this.confirmInFlight.set(pendingId, run);
    try {
      return await run;
    } finally {
      this.confirmInFlight.delete(pendingId);
    }
  }

  getPendingKycVerification(id: string): PendingKycVerification | undefined {
    let pending = this.pendingKycVerifications.get(id);
    if (!pending) {
      this.loadFromDisk();
      pending = this.pendingKycVerifications.get(id);
    }
    return pending;
  }

  async handleCheckoutCompletedWebhook(checkoutId: string): Promise<void> {
    for (const [pendingId, pending] of this.pendingKycVerifications.entries()) {
      if (pending.checkoutId === checkoutId) {
        try {
          await this.confirmKycPayment(pendingId);
        } catch (err) {
          console.error('[AjoStore] Failed to auto-confirm KYC from webhook:', err);
        }
        break;
      }
    }
  }

  async recordDeposit(accountNumber: string, amount: string, depositRef: string): Promise<boolean> {
    const mapping = this.accountToClubMap.get(accountNumber);
    if (!mapping) {
      console.warn(`[AjoStore] Deposit to unknown dedicated account ${accountNumber}`);
      return false;
    }

    const { clubId, memberId } = mapping;
    const club = this.clubs.get(clubId);
    if (!club) return false;

    const member = club.members.find((m) => m.id === memberId);
    if (!member) return false;

    const currentRound = club.rounds[club.currentRound - 1];
    if (!currentRound) return false;

    // Check if member already contributed in this round
    const existing = currentRound.contributions.find((c) => c.memberId === memberId);
    if (existing) {
      console.log(`[AjoStore] Member ${member.name} already contributed for Round ${currentRound.roundNumber}`);
      return true;
    }

    const contributionKobo = toKobo(amount);
    currentRound.contributions.push({
      memberId: member.id,
      memberName: member.name,
      amount: fromKobo(contributionKobo),
      paidAt: new Date().toISOString(),
      depositRef,
    });

    currentRound.collectedPotAmount = addMoney(currentRound.collectedPotAmount, fromKobo(contributionKobo));

    // Audit log
    club.auditLedger.push({
      id: `aud_${Date.now()}_dep`,
      timestamp: new Date().toISOString(),
      type: 'CONTRIBUTION_RECEIVED',
      description: `${formatNGN(amount)} deposited by ${member.name} for Round #${currentRound.roundNumber}.`,
      meta: {
        memberId: member.id,
        roundNumber: currentRound.roundNumber,
        depositRef,
      },
    });

    // Check if pot is full
    const targetKobo = toKobo(currentRound.targetPotAmount);
    const collectedKobo = toKobo(currentRound.collectedPotAmount);

    if (collectedKobo >= targetKobo) {
      currentRound.status = 'POT_FULL';
      // If was previously HELD_DEFICIT, log resolution
      club.auditLedger.push({
        id: `aud_${Date.now()}_pot_full`,
        timestamp: new Date().toISOString(),
        type: 'CONTRIBUTION_RECEIVED',
        description: `Round #${currentRound.roundNumber} pot is complete at ${formatNGN(currentRound.collectedPotAmount)}! Ready for disbursal.`,
      });
    }

    club.updatedAt = new Date().toISOString();
    this.broadcast(club.id);
    return true;
  }

  // Time simulation & disbursal triggers
  async advanceTime(clubId: string, targetDay: SimulatedDay): Promise<AjoClub> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error(`Club ${clubId} not found`);

    club.simulatedDay = targetDay;
    const currentRound = club.rounds[club.currentRound - 1];

    if (!currentRound) return club;

    // If advanced to Friday (Disbursal Day)
    if (targetDay === 'FRIDAY' && currentRound.status !== 'DISBURSED' && currentRound.status !== 'DISBURSED_PARTIAL') {
      const targetKobo = toKobo(currentRound.targetPotAmount);
      const collectedKobo = toKobo(currentRound.collectedPotAmount);

      if (collectedKobo >= targetKobo) {
        // Disburse full pot
        await this.disburseRound(club.id, currentRound.roundNumber);
      } else {
        // Deficit detected! Flag defaulter(s)
        currentRound.status = 'HELD_DEFICIT';
        const unpaidMembers = club.members.filter(
          (m) => !currentRound.contributions.some((c) => c.memberId === m.id)
        );

        for (const unpaid of unpaidMembers) {
          const reminder: AjoReminderEntry = {
            id: `rem_${Date.now()}_${unpaid.id}`,
            timestamp: new Date().toISOString(),
            memberId: unpaid.id,
            memberName: unpaid.name,
            phone: unpaid.phone,
            roundNumber: currentRound.roundNumber,
            channel: 'SMS',
            message: `URGENT: Your Round ${currentRound.roundNumber} contribution of ${formatNGN(
              club.contributionAmount
            )} is late! Please deposit to ${unpaid.dedicatedAccountNumber} (${unpaid.dedicatedBankName}) to avoid defaulting.`,
          };
          club.reminderLog.push(reminder);
        }

        club.auditLedger.push({
          id: `aud_${Date.now()}_deficit`,
          timestamp: new Date().toISOString(),
          type: 'DEFICIT_FLAGGED',
          description: `Disbursal held! Deficit of ${formatNGN(
            fromKobo(targetKobo - collectedKobo)
          )} detected on Friday. Uncredited: ${unpaidMembers.map((m) => m.name).join(', ')}.`,
          meta: {
            unpaidMemberIds: unpaidMembers.map((m) => m.id),
          },
        });
      }
    }

    club.updatedAt = new Date().toISOString();
    this.broadcast(club.id);
    return club;
  }

  async disburseRound(clubId: string, roundNumber: number, partialOverride = false): Promise<AjoRound> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error(`Club ${clubId} not found`);

    const round = club.rounds.find((r) => r.roundNumber === roundNumber);
    if (!round) throw new Error(`Round ${roundNumber} not found`);

    if (round.status === 'DISBURSED' || round.status === 'DISBURSED_PARTIAL') {
      return round;
    }

    const recipient = club.members.find((m) => m.id === round.recipientMemberId);
    if (!recipient) {
      throw new Error(`Round recipient not designated or not found`);
    }

    const amountToDisburse = partialOverride ? round.collectedPotAmount : round.targetPotAmount;
    if (toKobo(amountToDisburse) <= 0n) {
      throw new Error(`Cannot disburse pot with 0 balance`);
    }

    // Strictly enforce Idempotency Key format: ajo_payout_<clubId>_round<n>
    const idempotencyKey = `ajo_payout_${club.id}_round${round.roundNumber}`;

    try {
      const payout = await fossaClient.payouts.createMasterPayout(
        {
          accountNumber: recipient.payoutAccountNumber,
          bankCode: recipient.payoutBankCode,
          accountName: recipient.payoutAccountName,
          amount: amountToDisburse,
          reference: `ref_ajo_${club.id}_r${round.roundNumber}`,
          narration: `AjoSphere Disbursal - ${club.name} Round ${round.roundNumber}`,
        },
        idempotencyKey
      );

      round.payoutId = payout.id;
      round.payoutTxHash = payout.sessionId || `NIBSS_${Date.now()}_${payout.id.slice(-6)}`;
      round.status = partialOverride ? 'DISBURSED_PARTIAL' : 'DISBURSED';
      round.disbursedAt = new Date().toISOString();
      round.disbursedAmount = amountToDisburse;
      delete round.payoutError;

      club.auditLedger.push({
        id: `aud_${Date.now()}_disburse`,
        timestamp: new Date().toISOString(),
        type: 'POT_DISBURSED',
        description: `${formatNGN(amountToDisburse)} disbursed to recipient ${recipient.name} (${recipient.payoutBankName} - ${recipient.payoutAccountNumber}). Ref: ${payout.reference}.`,
        meta: {
          payoutId: payout.id,
          idempotencyKey,
          amount: amountToDisburse,
          partial: partialOverride,
        },
      });

      // Notification log
      club.reminderLog.push({
        id: `rem_${Date.now()}_win`,
        timestamp: new Date().toISOString(),
        memberId: recipient.id,
        memberName: recipient.name,
        phone: recipient.phone,
        roundNumber: round.roundNumber,
        channel: 'SMS',
        message: `Congratulations! Your ${formatNGN(amountToDisburse)} Ajo pot for Round ${round.roundNumber} has been paid to your ${recipient.payoutBankName} account.`,
      });

      club.updatedAt = new Date().toISOString();
      this.broadcast(club.id);
      return round;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      round.payoutError = msg;
      club.auditLedger.push({
        id: `aud_${Date.now()}_payerr`,
        timestamp: new Date().toISOString(),
        type: 'ADMIN_OVERRIDE',
        description: `Disbursal failure for Round #${round.roundNumber}: ${msg}`,
      });
      club.updatedAt = new Date().toISOString();
      this.broadcast(club.id);
      throw err;
    }
  }

  // Admin decision on defaulter
  async resolveDefaulter(clubId: string, action: 'wait' | 'disburse-partial'): Promise<AjoClub> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error(`Club ${clubId} not found`);

    const currentRound = club.rounds[club.currentRound - 1];
    if (!currentRound || currentRound.status !== 'HELD_DEFICIT') {
      throw new Error('Current round is not in HELD_DEFICIT state');
    }

    if (action === 'wait') {
      club.auditLedger.push({
        id: `aud_${Date.now()}_wait`,
        timestamp: new Date().toISOString(),
        type: 'ADMIN_OVERRIDE',
        description: `Admin chose to WAIT for late contributors. Disbursal paused until pot is complete.`,
      });
    } else if (action === 'disburse-partial') {
      await this.disburseRound(club.id, currentRound.roundNumber, true);
      club.auditLedger.push({
        id: `aud_${Date.now()}_partial`,
        timestamp: new Date().toISOString(),
        type: 'ADMIN_OVERRIDE',
        description: `Admin authorized PARTIAL disbursal of ${formatNGN(currentRound.collectedPotAmount)}. Round marked DISBURSED_PARTIAL.`,
      });
    }

    club.updatedAt = new Date().toISOString();
    this.broadcast(club.id);
    return club;
  }

  // Advance to next round
  advanceRound(clubId: string): AjoClub {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error(`Club ${clubId} not found`);

    if (club.currentRound >= club.totalRounds) {
      club.status = 'COMPLETED';
      club.auditLedger.push({
        id: `aud_${Date.now()}_complete`,
        timestamp: new Date().toISOString(),
        type: 'ADMIN_OVERRIDE',
        description: `All ${club.totalRounds} rotation rounds completed successfully! Club lifecycle concluded.`,
      });
    } else {
      club.currentRound += 1;
      club.simulatedDay = 'MONDAY';
      club.auditLedger.push({
        id: `aud_${Date.now()}_adv_round`,
        timestamp: new Date().toISOString(),
        type: 'ADMIN_OVERRIDE',
        description: `Advanced to Round #${club.currentRound}. Monday contribution window is now open.`,
      });
    }

    club.updatedAt = new Date().toISOString();
    this.broadcast(club.id);
    return club;
  }

  // SSE subscriptions
  subscribe(clubId: string, listener: (club: AjoClub) => void): () => void {
    if (!this.listeners.has(clubId)) {
      this.listeners.set(clubId, new Set());
    }
    const set = this.listeners.get(clubId)!;
    set.add(listener);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(clubId);
      }
    };
  }

  private broadcast(clubId: string): void {
    const club = this.clubs.get(clubId);
    if (!club) return;
    this.saveToDisk();
    const set = this.listeners.get(clubId);
    if (!set) return;

    for (const listener of set) {
      try {
        listener(club);
      } catch (err) {
        console.error('[AjoStore] Broadcast error:', err);
      }
    }
  }
}

// Global singleton attached to globalThis across hot reloads & serverless invocations
const globalForAjo = globalThis as unknown as { __ajosphereStore?: AjoClubStore };
export const ajoStore = globalForAjo.__ajosphereStore || new AjoClubStore();
globalForAjo.__ajosphereStore = ajoStore;
