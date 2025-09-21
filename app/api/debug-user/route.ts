import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

// GET /api/debug-user - Debug Clerk user data
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'No userId found', 
        authenticated: false 
      });
    }

    const clerkUser = await currentUser();
    
    if (!clerkUser) {
      return NextResponse.json({ 
        error: 'No Clerk user found', 
        userId,
        authenticated: true 
      });
    }

    // Extract and return all relevant user data
    const userData = {
      userId,
      clerkUser: {
        id: clerkUser.id,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        emailAddresses: clerkUser.emailAddresses?.map(email => ({
          emailAddress: email.emailAddress,
          id: email.id
        })),
        phoneNumbers: clerkUser.phoneNumbers?.map(phone => ({
          phoneNumber: phone.phoneNumber,
          id: phone.id
        })),
        createdAt: clerkUser.createdAt,
        updatedAt: clerkUser.updatedAt
      }
    };

    return NextResponse.json({ 
      success: true, 
      data: userData,
      emailFound: !!clerkUser.emailAddresses?.[0]?.emailAddress
    });
  } catch (error) {
    console.error('Error debugging user:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}
