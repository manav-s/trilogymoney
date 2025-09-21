import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

// POST /api/sync-user - Manually sync current user to database
export async function POST() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clerkUser = await currentUser();
    
    if (!clerkUser) {
      return NextResponse.json({ error: 'Clerk user not found' }, { status: 404 });
    }

    // Extract data from Clerk user
    const email = clerkUser.emailAddresses?.[0]?.emailAddress;
    const phone = clerkUser.phoneNumbers?.[0]?.phoneNumber;
    const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
    
    // For 3Numbers, support phone-only signup since SMS is our primary feature
    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone number required' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { clerkId: userId }
    });

    let user;
    
    if (existingUser) {
      // Update existing user
      user = await prisma.user.update({
        where: { clerkId: userId },
        data: {
          email: email || existingUser.email,
          phone: phone || existingUser.phone,
          name: name || existingUser.name,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          clerkId: userId,
          email: email || `${userId}@3numbers-phone-user.temp`, // Temporary email for phone-only users
          name: name || 'Phone User',
          phone: phone || '',
          timezone: 'America/New_York',
          isVerified: false
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      data: user,
      message: existingUser ? 'User updated successfully' : 'User created successfully'
    });
  } catch (error) {
    console.error('Error syncing user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
