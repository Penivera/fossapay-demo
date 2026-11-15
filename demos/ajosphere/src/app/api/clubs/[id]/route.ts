import { NextRequest, NextResponse } from 'next/server';
import { ajoStore } from '@/lib/clubStore';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const club = ajoStore.getClub(id);

  if (!club) {
    return NextResponse.json({ status: 'error', message: 'Club not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: 'success',
    data: club,
  });
}
