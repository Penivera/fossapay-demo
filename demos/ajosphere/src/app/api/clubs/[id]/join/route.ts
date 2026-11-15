import { NextRequest, NextResponse } from 'next/server';
import { ajoStore } from '@/lib/clubStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { kycMethod, identityNumber, accountNumber, bankCode, email, phone } = body;

    if (!kycMethod || (kycMethod !== 'BVN' && kycMethod !== 'NIN')) {
      return NextResponse.json(
        { status: 'error', message: 'kycMethod must be either BVN or NIN' },
        { status: 400 }
      );
    }

    if (!identityNumber || String(identityNumber).trim().length !== 11) {
      return NextResponse.json(
        { status: 'error', message: `${kycMethod} must be exactly 11 digits` },
        { status: 400 }
      );
    }

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { status: 'error', message: 'accountNumber and bankCode are required' },
        { status: 400 }
      );
    }

    const { member, club } = await ajoStore.joinClub({
      clubId: id,
      kycMethod,
      identityNumber: String(identityNumber).trim(),
      accountNumber: String(accountNumber).trim(),
      bankCode: String(bankCode).trim(),
      email,
      phone,
    });

    return NextResponse.json({
      status: 'success',
      data: {
        member,
        club,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to join club';
    return NextResponse.json({ status: 'error', message }, { status: 400 });
  }
}
