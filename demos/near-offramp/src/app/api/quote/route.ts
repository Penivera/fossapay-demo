import { NextRequest, NextResponse } from 'next/server';
import { isLiveMode } from '@fossapay/client';
import { defaultSolver } from '../../../lib/solver';

const LIVE_SOLVER_MESSAGE =
  'Live cross-chain routing (NEAR Intents) is not connected in this build, so quotes are unavailable in live mode.';

export async function POST(req: NextRequest) {
  // The solver is a simulation. Never present fabricated quotes or deposit addresses as real.
  if (isLiveMode()) {
    return NextResponse.json({ status: 'error', message: LIVE_SOLVER_MESSAGE }, { status: 503 });
  }
  try {
    const body = await req.json();
    const { originAsset, amountIn } = body;

    if (!amountIn || Number(amountIn) <= 0) {
      return NextResponse.json(
        { status: 'error', message: 'Valid amountIn is required.' },
        { status: 400 }
      );
    }

    const quote = await defaultSolver.getQuote({
      originAsset: originAsset || {
        id: 'nep141:arbitrum-usdt.omft.near',
        symbol: 'USDT',
        chain: 'Arbitrum',
        decimals: 6,
      },
      amountIn: String(amountIn),
    });

    return NextResponse.json({
      status: 'success',
      data: quote,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Failed to compute quote.' },
      { status: 500 }
    );
  }
}
