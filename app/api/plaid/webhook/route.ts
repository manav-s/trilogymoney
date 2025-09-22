import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

export async function POST(req: NextRequest) {
  try {
    const webhook = await req.json();
    const { webhook_type, webhook_code, item_id, error } = webhook;

    console.log('Plaid webhook received:', { webhook_type, webhook_code, item_id });

    switch (webhook_type) {
      case 'TRANSACTIONS':
        await handleTransactionsWebhook(webhook_code, item_id);
        break;
      
      case 'ITEM':
        await handleItemWebhook(webhook_code, item_id, error);
        break;
      
      case 'ASSETS':
        // Handle asset webhooks if needed
        console.log('Assets webhook received:', webhook_code);
        break;
      
      default:
        console.log('Unhandled webhook type:', webhook_type);
    }

    return NextResponse.json({ acknowledged: true });
  } catch (error) {
    console.error('Error processing Plaid webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleTransactionsWebhook(webhookCode: string, itemId: string) {
  console.log('Processing transactions webhook:', webhookCode, itemId);
  
  // Find the Plaid account
  const plaidAccount = await prisma.plaidAccount.findFirst({
    where: { itemId: itemId, isActive: true }
  });

  if (!plaidAccount) {
    console.error('Plaid account not found for item:', itemId);
    return;
  }

  switch (webhookCode) {
    case 'INITIAL_UPDATE':
    case 'HISTORICAL_UPDATE':
    case 'DEFAULT_UPDATE':
      // Fetch and store new transactions
      try {
        const accessToken = decrypt(plaidAccount.accessToken);
        
        // Get transactions for the last 30 days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const transactionsResponse = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: startDate.toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
        });

        console.log(`Fetched ${transactionsResponse.data.transactions.length} transactions for item ${itemId}`);
        
        // Here you would typically store the transactions in your database
        // For now, we'll just log them
        
      } catch (error) {
        console.error('Error fetching transactions:', error);
      }
      break;

    default:
      console.log('Unhandled transactions webhook code:', webhookCode);
  }
}

async function handleItemWebhook(webhookCode: string, itemId: string, error?: any) {
  console.log('Processing item webhook:', webhookCode, itemId);
  
  const plaidAccount = await prisma.plaidAccount.findFirst({
    where: { itemId: itemId }
  });

  if (!plaidAccount) {
    console.error('Plaid account not found for item:', itemId);
    return;
  }

  switch (webhookCode) {
    case 'ERROR':
      // Handle item errors (e.g., expired credentials)
      console.error('Plaid item error:', error);
      await prisma.plaidAccount.update({
        where: { id: plaidAccount.id },
        data: { 
          isActive: false,
          lastError: JSON.stringify(error)
        }
      });
      break;

    case 'PENDING_EXPIRATION':
      // Handle pending expiration
      console.log('Plaid item pending expiration:', itemId);
      break;

    default:
      console.log('Unhandled item webhook code:', webhookCode);
  }
}
