import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { plaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES } from '@/lib/plaid';
import { getOrCreateUser } from '@/lib/user-utils';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user information for Plaid Link
    const user = await getOrCreateUser();
    const clerkUser = await currentUser();
    
    if (!user || !clerkUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create link token request
    const linkTokenRequest = {
      user: {
        client_user_id: userId,
      },
      client_name: '3Numbers',
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language: 'en',
      webhook: process.env.PLAID_WEBHOOK_URL || `${process.env.NEXT_PUBLIC_URL}/api/plaid/webhook`,
    };

    console.log('Creating Plaid link token with request:', JSON.stringify(linkTokenRequest, null, 2));
    console.log('Plaid ENV variables:', {
      clientId: process.env.PLAID_CLIENT_ID,
      env: process.env.PLAID_ENV,
      hasSecret: !!process.env.PLAID_SECRET,
    });

    const response = await plaidClient.linkTokenCreate(linkTokenRequest);
    
    return NextResponse.json({ 
      link_token: response.data.link_token,
      expiration: response.data.expiration
    });
  } catch (error: any) {
    console.error('Error creating Plaid link token:', error);
    console.error('Plaid error details:', error.response?.data);
    return NextResponse.json({ 
      error: 'Failed to create link token',
      message: error.response?.data?.error_message || error.message,
      details: process.env.NODE_ENV === 'development' ? error.response?.data : undefined
    }, { status: 500 });
  }
}
