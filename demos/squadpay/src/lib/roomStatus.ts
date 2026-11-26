export type RoomStatus = 'active' | 'completed' | 'partially_closed';

const ROOM_STATUS_RANK: Record<RoomStatus, number> = {
  active: 0,
  partially_closed: 1,
  completed: 2,
};

export function isSettledRoomStatus(status: string | undefined): boolean {
  return status === 'completed' || status === 'partially_closed';
}

function countPaid(room: any): number {
  if (!Array.isArray(room?.participants)) return 0;
  return room.participants.filter((p: any) => p.status === 'paid').length;
}

function countCheckouts(room: any): number {
  if (!Array.isArray(room?.participants)) return 0;
  return room.participants.filter((p: any) => Boolean(p.checkout?.id)).length;
}

/**
 * Returns true if `incoming` represents equal-or-newer progress than `current`
 * and carries a meaningful change (never regressing paid shares or settlement).
 */
export function shouldAcceptRoomUpdate(current: any, incoming: any): boolean {
  if (!incoming || !incoming.id) return false;
  if (!current || current.id !== incoming.id) return true;

  const curRank = ROOM_STATUS_RANK[current.status as RoomStatus] ?? -1;
  const incRank = ROOM_STATUS_RANK[incoming.status as RoomStatus] ?? -1;

  if (incRank < curRank) return false;
  if (incRank > curRank) return true;

  if (isSettledRoomStatus(current.status)) {
    return !current.payout && Boolean(incoming.payout);
  }

  const curPaid = countPaid(current);
  const incPaid = countPaid(incoming);
  if (incPaid < curPaid) return false;
  if (incPaid > curPaid) return true;

  const curCo = countCheckouts(current);
  const incCo = countCheckouts(incoming);
  if (incCo > curCo) return true;

  const curTime = Date.parse(current.updatedAt || '') || 0;
  const incTime = Date.parse(incoming.updatedAt || '') || 0;
  return incTime > curTime;
}
