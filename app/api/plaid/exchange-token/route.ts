import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { public_token, metadata } = await req.json();

    if (!public_token) {
      return NextResponse.json({ error: 'Public token required' }, { status: 400 });
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: public_token
    });

    const { access_token, item_id } = exchangeResponse.data;

    // Get account information
    const accountsResponse = await plaidClient.accountsGet({
      access_token: access_token
    });

    const accounts = accountsResponse.data.accounts;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Encrypt the access token for secure storage
    const encryptedAccessToken = encrypt(access_token);

    // Store Plaid account data (using the first account for now)
    const primaryAccount = accounts[0];
    
    const plaidAccount = await prisma.plaidAccount.upsert({
      where: { userId: user.id },
      update: {
        accessToken: encryptedAccessToken,
        itemId: item_id,
        accountId: primaryAccount.account_id,
        bankName: metadata?.institution?.name || 'Unknown Bank',
        accountName: primaryAccount.name || primaryAccount.official_name || 'Account',
        accountType: primaryAccount.subtype || primaryAccount.type || 'depository',
        isActive: true,
        lastSync: new Date(),
      },
      create: {
        userId: user.id,
        accessToken: encryptedAccessToken,
        itemId: item_id,
        accountId: primaryAccount.account_id,
        bankName: metadata?.institution?.name || 'Unknown Bank',
        accountName: primaryAccount.name || primaryAccount.official_name || 'Account',
        accountType: primaryAccount.subtype || primaryAccount.type || 'depository',
        isActive: true,
      }
    });

    // Return success with account info (without sensitive data)
    return NextResponse.json({
      success: true,
      accounts: accounts.map(account => ({
        account_id: account.account_id,
        name: account.name,
        official_name: account.official_name,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask
      })),
      institution: {
        name: metadata?.institution?.name || 'Unknown Bank',
        id: metadata?.institution?.institution_id || ''
      }
    });
  } catch (error) {
    console.error('Error exchanging Plaid token:', error);
    return NextResponse.json({ 
      error: 'Failed to exchange token',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
