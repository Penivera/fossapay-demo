import { NextRequest, NextResponse } from 'next/server';
import { defaultSolver } from '../../../lib/solver';

export async function POST(req: NextRequest) {
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
