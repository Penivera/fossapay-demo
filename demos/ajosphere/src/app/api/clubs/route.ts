import { NextRequest, NextResponse } from 'next/server';
import { ajoStore } from '@/lib/clubStore';

export async function GET() {
  const clubs = ajoStore.listClubs();
  return NextResponse.json({
    status: 'success',
    data: clubs,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, contributionAmount, totalRounds } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { status: 'error', message: 'Club name is required' },
        { status: 400 }
      );
    }

    if (!contributionAmount || Number(contributionAmount) <= 0) {
      return NextResponse.json(
        { status: 'error', message: 'Valid contribution amount is required' },
        { status: 400 }
      );
    }

    const club = ajoStore.createClub({
      name,
      contributionAmount: String(contributionAmount),
      totalRounds: totalRounds ? Number(totalRounds) : 5,
    });

    return NextResponse.json({
      status: 'success',
      data: club,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create club';
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
