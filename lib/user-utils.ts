import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from './db';
import type { User } from '@prisma/client';

/**
 * Get or create user in database from Clerk authentication
 */
export async function getOrCreateUser(): Promise<User | null> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return null;
    }

    // Check if user exists in database
    let user = await prisma.user.findUnique({
      where: { clerkId: userId }
    });

    // If user doesn't exist, create them
    if (!user) {
      const clerkUser = await currentUser();
      
      if (!clerkUser) {
        console.error('Clerk user not found for userId:', userId);
        return null;
      }

      const email = clerkUser.emailAddresses?.[0]?.emailAddress;
      const phone = clerkUser.phoneNumbers?.[0]?.phoneNumber;
      const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
      
      // For 3Numbers, we support phone-only signup since SMS is our primary feature
      if (!email && !phone) {
        console.error('No email or phone found for Clerk user:', userId, clerkUser);
        return null;
      }

      user = await prisma.user.create({
        data: {
          clerkId: userId,
          email: email || `${userId}@3numbers-phone-user.temp`, // Temporary email for phone-only users
          name: name || 'Phone User',
          phone: phone || '',
          city: '',
          timezone: 'America/New_York',
          isVerified: false
        }
      });
    }

    return user;
  } catch (error) {
    console.error('Error getting or creating user:', error);
    return null;
  }
}

/**
 * Get user by Clerk ID
 */
export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  try {
    return await prisma.user.findUnique({
      where: { clerkId },
      include: {
        subscription: true,
        plaidAccount: true,
        dailyNumbers: {
          orderBy: { date: 'desc' },
          take: 7
        }
      }
    });
  } catch (error) {
    console.error('Error getting user by Clerk ID:', error);
    return null;
  }
}

/**
 * Update user profile data
 */
export async function updateUserProfile(
  clerkId: string,
  data: {
    name?: string;
    phone?: string;
    city?: string;
    timezone?: string;
    messageTime?: number;
    messageEnabled?: boolean;
  }
): Promise<User | null> {
  try {
    return await prisma.user.update({
      where: { clerkId },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return null;
  }
}

/**
 * Check if user needs onboarding (missing required fields)
 */
export function userNeedsOnboarding(user: User): boolean {
  return !user.phone || !user.city || !user.isVerified;
}

/**
 * Mark user as verified after completing onboarding
 */
export async function markUserAsVerified(clerkId: string): Promise<User | null> {
  try {
    return await prisma.user.update({
      where: { clerkId },
      data: {
        isVerified: true,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error marking user as verified:', error);
    return null;
  }
}
