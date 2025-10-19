import { NextRequest, NextResponse } from 'next/server';
import { createLinkToken } from '@/lib/plaid';

export async function POST(req: NextRequest) {
  try {
    const { clientUserId, clientName } = await req.json();
    if (!clientUserId) return NextResponse.json({ error: 'clientUserId required' }, { status: 400 });
    const token = await createLinkToken({ clientUserId, clientName: clientName || 'Trilogy' });
    return NextResponse.json({ link_token: token });
  } catch (e) {
    return NextResponse.json({ error: 'failed to create link token' }, { status: 500 });
  }
}


