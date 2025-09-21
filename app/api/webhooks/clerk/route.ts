import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { prisma } from '@/lib/db';

// Clerk webhook endpoint for user creation/updates
export async function POST(req: NextRequest) {
  try {
    // Get webhook secret from environment
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!WEBHOOK_SECRET) {
      console.error('Missing CLERK_WEBHOOK_SECRET environment variable');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // Get headers
    const headersList = await headers();
    const svix_id = headersList.get('svix-id');
    const svix_timestamp = headersList.get('svix-timestamp');
    const svix_signature = headersList.get('svix-signature');

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
    }

    // Get request body
    const payload = await req.text();

    // Verify webhook
    const wh = new Webhook(WEBHOOK_SECRET);
    let evt;

    try {
      evt = wh.verify(payload, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    // Handle different event types
    const { type, data } = evt;

    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
        
      case 'user.updated':
        await handleUserUpdated(data);
        break;
        
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
        
      default:
        console.log(`Unhandled webhook event type: ${type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleUserCreated(data: any) {
  try {
    const { id: clerkId, email_addresses, phone_numbers, first_name, last_name } = data;
    
    const email = email_addresses?.[0]?.email_address;
    const phone = phone_numbers?.[0]?.phone_number;
    const name = `${first_name || ''} ${last_name || ''}`.trim();
    
    // For 3Numbers, support phone-only signup since SMS is our primary feature
    if (!email && !phone) {
      console.error('No email or phone found for user:', clerkId);
      return;
    }

    // Create user in our database
    const user = await prisma.user.create({
      data: {
        clerkId,
        email: email || `${clerkId}@3numbers-phone-user.temp`, // Temporary email for phone-only users
        name: name || 'Phone User',
        phone: phone || '', // Use phone from Clerk if available
        timezone: 'America/New_York', // Default timezone
        isVerified: false
      }
    });

    console.log('User created in database:', user.id);
  } catch (error) {
    console.error('Error creating user in database:', error);
  }
}

async function handleUserUpdated(data: any) {
  try {
    const { id: clerkId, email_addresses, first_name, last_name } = data;
    
    const email = email_addresses?.[0]?.email_address;
    const name = `${first_name || ''} ${last_name || ''}`.trim();
    
    // Update user in our database
    await prisma.user.updateMany({
      where: { clerkId },
      data: {
        ...(email && { email }),
        ...(name && { name }),
        updatedAt: new Date()
      }
    });

    console.log('User updated in database:', clerkId);
  } catch (error) {
    console.error('Error updating user in database:', error);
  }
}

async function handleUserDeleted(data: any) {
  try {
    const { id: clerkId } = data;
    
    // Delete user and all related data
    await prisma.user.delete({
      where: { clerkId }
    });

    console.log('User deleted from database:', clerkId);
  } catch (error) {
    console.error('Error deleting user from database:', error);
  }
}
