import { shouldAcceptRoomUpdate } from './roomStatus';

export interface CachedRoom {
  id: string;
  title: string;
  totalAmount: string;
  status: string;
  snapshot?: any;
  updatedAt: string;
}

const STORAGE_KEY = 'squadpay_cached_rooms';

export function getCachedRooms(): CachedRoom[] {
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

export function getCachedRoomSnapshot(id: string): any | undefined {
  const entry = getCachedRooms().find((r) => r.id === id);
  if (!entry) return undefined;
  return entry.snapshot && Array.isArray(entry.snapshot.participants) ? entry.snapshot : undefined;
}

export function saveCachedRoom(room: any) {
  if (typeof window === 'undefined' || !room || !room.id) return;
  try {
    const existing = getCachedRooms();
    const prev = existing.find((r) => r.id === room.id);
    const prevComparable = prev?.snapshot || prev;
    if (prevComparable && !shouldAcceptRoomUpdate(prevComparable, room)) {
      return;
    }
    const entry: CachedRoom = {
      id: room.id,
      title: room.title || 'Squad Split',
      totalAmount: room.totalAmount || '0',
      status: room.status || 'active',
      snapshot: Array.isArray(room.participants) ? room : prev?.snapshot,
      updatedAt: room.updatedAt || new Date().toISOString(),
    };
    const filtered = existing.filter((r) => r.id !== room.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...filtered].slice(0, 50)));
  } catch {}
}
