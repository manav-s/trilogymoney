import { NextRequest, NextResponse } from 'next/server';
import { createLinkToken } from '@/lib/plaid';

export async function POST(req: NextRequest) {
  try {
    const { clientUserId, clientName } = await req.json();
    if (!clientUserId) return NextResponse.json({ error: 'clientUserId required' }, { status: 400 });
    const token = await createLinkToken({ clientUserId, clientName: clientName || 'Trilogy' });
    return NextResponse.json({ link_token: token });
  } catch (e: unknown) {
    // Surface Plaid error details for debugging (safe fields only)
    const err = e as { response?: { status?: number; data?: any } ; message?: string };
    const status = err?.response?.status || 500;
    const data = err?.response?.data || {};
    return NextResponse.json({
      error: data.error_message || err?.message || 'failed to create link token',
      code: data.error_code || data.error_type || 'UNKNOWN',
    }, { status });
  }
}


