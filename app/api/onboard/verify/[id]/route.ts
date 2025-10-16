import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLink } from '@/lib/magic-link';
import { z } from 'zod';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const raw = await params;
    const parsed = z.object({ id: z.string().min(1) }).parse(raw);
    const { id } = parsed;

    if (!id) {
      return NextResponse.json({ valid: false, error: 'ID missing' }, { status: 400 });
    }

    const result = await verifyMagicLink(id);

    if (result.valid) {
      return NextResponse.json({ valid: true, phone: result.phone }, { status: 200 });
    } else if (result.expired) {
      return NextResponse.json({ valid: false, expired: true, error: 'Link expired' }, { status: 401 });
    } else {
      return NextResponse.json({ valid: false, error: 'Invalid link' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ valid: false, error: 'Internal server error' }, { status: 500 });
  }
}

