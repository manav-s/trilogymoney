import { NextRequest, NextResponse } from 'next/server';
import { createLinkToken } from '@/lib/integrations/plaid';

export async function POST(req: NextRequest) {
  try {
    const { clientUserId, clientName } = await req.json();
    if (!clientUserId) return NextResponse.json({ error: 'clientUserId required' }, { status: 400 });
    const token = await createLinkToken({ clientUserId, clientName: clientName || 'Trilogy' });
    return NextResponse.json({ link_token: token });
  } catch (e: unknown) {
    // Surface Plaid error details for debugging (safe fields only)
    type PlaidErrorData = { error_message?: string; error_code?: string; error_type?: string };
    type PlaidError = { response?: { status?: number; data?: PlaidErrorData } ; message?: string };
    const err = e as PlaidError;
    const status = err.response?.status || 500;
    const data: PlaidErrorData = err.response?.data || {};
    return NextResponse.json({
      error: data.error_message || err?.message || 'failed to create link token',
      code: data.error_code || data.error_type || 'UNKNOWN',
    }, { status });
  }
}


