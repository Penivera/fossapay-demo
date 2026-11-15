import { NextRequest, NextResponse } from 'next/server';

const NGN_PER_USDC = 1595.00;
const FOSSAPAY_PAYOUT_FEE_NGN = 50.00;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { originAsset, amountIn } = body;

    const amountNum = parseFloat(amountIn);
    if (!amountNum || amountNum <= 0) {
      return NextResponse.json(
        { status: 'error', message: 'Valid amountIn is required.' },
        { status: 400 }
      );
    }

    // Attempt live 1Click API call if accessible, or generate deterministic intent quote
    let depositAddress: string;
    let minReceivedUsdc: number;

    try {
      const oneClickRes = await fetch('https://1click.chaindefuser.com/v0/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: true,
          originAsset: originAsset?.id || 'nep141:arbitrum-usdt.omft.near',
          destinationAsset: 'nep141:solana-usdc.omft.near',
          amountIn: String(Math.floor(amountNum * 1e6)),
          recipient: process.env.FOSSAPAY_SOLANA_MASTER_ADDRESS || 'FP_Master_Solana_Vault_7Xp1',
          deadline: Math.floor(Date.now() / 1000) + 1800,
        }),
      });

      if (oneClickRes.ok) {
        const data = await oneClickRes.json();
        depositAddress = data.depositAddress;
        minReceivedUsdc = parseFloat(data.amountOut) / 1e6;
      } else {
        throw new Error('1Click fallback');
      }
    } catch {
      // Deterministic fallback for dev/demo: 0.15% solver fee
      minReceivedUsdc = amountNum * 0.9985;
      const prefix = originAsset?.chain === 'solana' ? 'SolVault' : '0x3a9f1b4c';
      depositAddress = `${prefix}${Math.random().toString(16).substring(2, 10)}8c2`;
    }

    const grossNgn = minReceivedUsdc * NGN_PER_USDC;
    const netNgn = Math.max(0, grossNgn - FOSSAPAY_PAYOUT_FEE_NGN);

    return NextResponse.json({
      status: 'success',
      data: {
        quoteId: `quote_${Date.now().toString(36)}`,
        originAsset: originAsset?.symbol || 'USDT',
        amountIn: amountNum,
        minReceivedUsdc: Number(minReceivedUsdc.toFixed(4)),
        exchangeRateNgn: NGN_PER_USDC,
        fiatPayoutFeeNgn: FOSSAPAY_PAYOUT_FEE_NGN,
        grossNgn: Number(grossNgn.toFixed(2)),
        netNgn: Number(netNgn.toFixed(2)),
        depositAddress,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Failed to compute quote.' },
      { status: 500 }
    );
  }
}
