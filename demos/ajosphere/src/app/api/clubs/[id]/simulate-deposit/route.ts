import { NextRequest, NextResponse } from 'next/server';
import { ajoStore, defaultMockLedger } from '@/lib/clubStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const club = ajoStore.getClub(id);
    if (!club) {
      return NextResponse.json({ status: 'error', message: 'Club not found' }, { status: 404 });
    }

    const body = await req.json();
    const { memberId, accountNumber, amount } = body;

    let targetMember = club.members.find((m) => m.id === memberId);
    if (!targetMember && accountNumber) {
      targetMember = club.members.find((m) => m.dedicatedAccountNumber === accountNumber);
    }

    if (!targetMember) {
      return NextResponse.json(
        { status: 'error', message: 'Target member not found in this club' },
        { status: 404 }
      );
    }

    const depositAmount = amount ? String(amount) : club.contributionAmount;
    const ref = `dep_${Date.now()}_${targetMember.id}`;

    // 1. Simulate in mock ledger (which also dispatches signed deposit.completed webhook)
    await defaultMockLedger.simulateDeposit(
      targetMember.dedicatedAccountNumber,
      depositAmount,
      {
        accountName: targetMember.payoutAccountName,
        accountNumber: targetMember.payoutAccountNumber,
        bankCode: targetMember.payoutBankCode,
      }
    );

    // 2. Also record immediately in local club store for instant SSE reactivity
    await ajoStore.recordDeposit(targetMember.dedicatedAccountNumber, depositAmount, ref);

    const updated = ajoStore.getClub(id);

    return NextResponse.json({
      status: 'success',
      data: {
        club: updated,
        member: targetMember,
        amount: depositAmount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to simulate deposit';
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
