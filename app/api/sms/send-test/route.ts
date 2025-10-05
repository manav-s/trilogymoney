import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sendDailyUpdate } from '@/lib/twilio';
import { prisma } from '@/lib/db';

/**
 * POST /api/sms/send-test
 * Send a test SMS message to the authenticated user
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        plaidAccount: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.phone) {
      return NextResponse.json({ error: 'Phone number not found' }, { status: 400 });
    }

    // For now, use dummy data until we implement transaction analysis
    const testData = {
      name: user.name,
      bankBalance: 2547.83,
      yesterdaySpending: -47.20,
      weekSpending: -312.45,
      bankName: user.plaidAccount?.bankName || undefined,
    };

    // Send the SMS
    const result = await sendDailyUpdate(user.phone, testData);

    return NextResponse.json({
      success: true,
      message: 'Test SMS sent successfully',
      phone: user.phone,
      messageSid: result.messageSid,
    });
  } catch (error: any) {
    console.error('Error sending test SMS:', error);
    return NextResponse.json(
      {
        error: 'Failed to send SMS',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

