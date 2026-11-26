export type DealStatus =
  | 'DRAFT'
  | 'WAITING_PAYMENT'
  | 'ESCROW_LOCKED'
  | 'DISPATCHED'
  | 'INSPECTION_PERIOD'
  | 'RELEASED'
  | 'DISPUTED'
  | 'REFUNDED';

export const DEAL_STATUS_RANK: Record<DealStatus, number> = {
  DRAFT: 0,
  WAITING_PAYMENT: 1,
  ESCROW_LOCKED: 2,
  DISPATCHED: 3,
  INSPECTION_PERIOD: 4,
  DISPUTED: 5,
  RELEASED: 6,
  REFUNDED: 6,
};

export function isTerminalDealStatus(status: string | undefined): boolean {
  return status === 'RELEASED' || status === 'REFUNDED';
}

export function getDealStatusRank(status: string | undefined): number {
  if (!status) return -1;
  return DEAL_STATUS_RANK[status as DealStatus] ?? -1;
}

/**
 * Returns true if `incoming` represents equal-or-newer progress than `current`
 * and actually carries a meaningful change (never regressing a deal backwards).
 */
export function shouldAcceptDealUpdate(current: any, incoming: any): boolean {
  if (!incoming || !incoming.id) return false;
  if (!current || current.id !== incoming.id) return true;

  const curRank = getDealStatusRank(current.status);
  const incRank = getDealStatusRank(incoming.status);

  if (incRank < curRank) return false;
  if (incRank > curRank) return true;

  // Same status rank: terminal deals never change again
  if (isTerminalDealStatus(current.status)) return false;

  const curCheckoutId = current.checkout?.id || '';
  const incCheckoutId = incoming.checkout?.id || '';
  if (!curCheckoutId && incCheckoutId) return true;

  const curHistoryLen = Array.isArray(current.history) ? current.history.length : 0;
  const incHistoryLen = Array.isArray(incoming.history) ? incoming.history.length : 0;
  if (incHistoryLen > curHistoryLen) return true;

  const curTime = Date.parse(current.updatedAt || '') || 0;
  const incTime = Date.parse(incoming.updatedAt || '') || 0;
  return incTime > curTime;
}
