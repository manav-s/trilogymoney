import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

// GET /api/users - Get current user data
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        subscription: true,
        plaidAccount: true,
        dailyNumbers: {
          orderBy: { date: 'desc' },
          take: 7 // Last 7 days
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/users - Create or update user from Clerk data
export async function POST(req: NextRequest) {
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
    const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
    
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
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
          email,
          name: name || existingUser.name,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          clerkId: userId,
          email,
          name: name || 'Anonymous User',
          phone: '', // Will be collected during onboarding
          timezone: 'America/New_York', // Default, will be updated during onboarding
          isVerified: false
        }
      });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/users - Update user profile data
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, timezone, messageTime, messageEnabled, isVerified } = body;

    const user = await prisma.user.update({
      where: { clerkId: userId },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(timezone && { timezone }),
        ...(messageTime !== undefined && { messageTime }),
        ...(messageEnabled !== undefined && { messageEnabled }),
        ...(isVerified !== undefined && { isVerified }),
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
