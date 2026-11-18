import { NextRequest, NextResponse } from 'next/server';
import { intentStore } from '../../../../lib/intentStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      quoteId,
      originAsset,
      amountIn,
      minReceivedUsdc,
      netNgn,
      exchangeRateNgn,
      recipient,
    } = body;

    if (!quoteId || !amountIn || !netNgn || !recipient?.accountNumber || !recipient?.bankCode) {
      return NextResponse.json(
        { status: 'error', message: 'Missing required intent session parameters.' },
        { status: 400 }
      );
    }

    const session = intentStore.createSession({
      quoteId,
      originAsset: originAsset || { symbol: 'USDT', chain: 'Arbitrum' },
      amountIn: String(amountIn),
      minReceivedUsdc: String(minReceivedUsdc || '99.90'),
      netNgn: String(netNgn),
      exchangeRateNgn: String(exchangeRateNgn || '1595.00'),
      recipient: {
        accountNumber: recipient.accountNumber,
        accountName: recipient.accountName || 'BENEFICIARY',
        bankCode: recipient.bankCode,
        bankName: recipient.bankName || recipient.bankCode,
      },
    });

    return NextResponse.json({
      status: 'success',
      data: session,
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to create intent session' },
      { status: 500 }
    );
  }
}
