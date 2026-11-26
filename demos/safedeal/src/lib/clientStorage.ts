import { shouldAcceptDealUpdate } from './dealStatus';

export interface CachedDeal {
  id: string;
  title: string;
  description?: string;
  price: string;
  status: string;
  role: 'seller' | 'buyer';
  sellerToken?: string;
  checkout?: {
    accountNumber?: string;
    bankName?: string;
    amountPayable?: string;
    expiresAt?: string;
  };
  /** Full deal snapshot so client sync restores seller, buyer, history, and payout refs cleanly. */
  snapshot?: any;
  updatedAt: string;
}

const STORAGE_KEY = 'safedeal_cached_deals';

export function getCachedDeals(): CachedDeal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getCachedDeal(id: string): CachedDeal | undefined {
  const deals = getCachedDeals();
  return deals.find((d) => d.id === id);
}

export function getCachedDealSnapshot(id: string): any | undefined {
  const entry = getCachedDeal(id);
  if (!entry) return undefined;
  return entry.snapshot && entry.snapshot.seller ? entry.snapshot : undefined;
}

export function saveCachedDeal(deal: any, role: 'seller' | 'buyer' = 'buyer'): void {
  if (typeof window === 'undefined' || !deal || !deal.id) return;
  try {
    const existing = getCachedDeals();
    const prev = existing.find((d) => d.id === deal.id);
    const prevComparable = prev?.snapshot || prev;
    if (prevComparable && !shouldAcceptDealUpdate(prevComparable, deal)) {
      return;
    }

    const token = deal.seller?.sellerToken || deal.sellerToken || prev?.sellerToken;
    const isSeller = role === 'seller' || prev?.role === 'seller' || Boolean(token);

    const entry: CachedDeal = {
      id: deal.id,
      title: deal.title || 'Escrow Deal',
      description: deal.description,
      price: deal.price || '0',
      status: deal.status || 'DRAFT',
      role: isSeller ? 'seller' : 'buyer',
      sellerToken: token,
      checkout: deal.checkout
        ? {
            accountNumber: deal.checkout.accountNumber,
            bankName: deal.checkout.bankName,
            amountPayable: deal.checkout.amountPayable,
            expiresAt: deal.checkout.expiresAt,
          }
        : undefined,
      snapshot: deal.seller ? deal : prev?.snapshot,
      updatedAt: deal.updatedAt || new Date().toISOString(),
    };

    const remaining = existing.filter((d) => d.id !== deal.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...remaining].slice(0, 50)));
  } catch {}
}

export function removeCachedDeal(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getCachedDeals();
    const remaining = existing.filter((d) => d.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  } catch {}
}
