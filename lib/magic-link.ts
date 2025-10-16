/**
 * Magic Link system for phone-based onboarding
 * - Short URLs using database-stored tokens
 * - 10-minute expiry
 * - Single-use tokens
 * - Bound to phone number
 */

import { nanoid } from 'nanoid';
import { prisma } from './db';

/**
 * Generate a short magic link for onboarding
 */
export async function generateMagicLink(phone: string): Promise<string> {
  // Generate a short, cryptographically secure ID
  const id = nanoid(10); // ~170 bits of entropy
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store in database
  await prisma.magicLink.create({
    data: {
      id,
      phone,
      expiresAt,
    },
  });

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').trim();
  return `${baseUrl}/onboard/${id.trim()}`;
}

/**
 * Verify and consume a magic link token (one-time use)
 */
export async function verifyMagicLink(id: string): Promise<{ valid: boolean; expired?: boolean; phone?: string }> {
  try {
    // Look up the magic link
    const magicLink = await prisma.magicLink.findUnique({
      where: { id },
    });

    if (!magicLink) {
      console.warn('[MagicLink] Token not found:', id);
      return { valid: false };
    }

    // Check if already used
    if (magicLink.used) {
      console.warn('[MagicLink] Token already used:', id);
      return { valid: false, expired: true };
    }

    // Check if expired
    if (magicLink.expiresAt < new Date()) {
      console.warn('[MagicLink] Token expired:', id);
      return { valid: false, expired: true };
    }

    // Mark as used
    await prisma.magicLink.update({
      where: { id },
      data: { used: true },
    });

    return { valid: true, phone: magicLink.phone };
  } catch (error) {
    console.error('[MagicLink] Verification error:', error);
    return { valid: false };
  }
}

/**
 * Cleanup expired magic links (run as cron job)
 */
export async function cleanupExpiredMagicLinks(): Promise<number> {
  const result = await prisma.magicLink.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  console.log(`[MagicLink] Cleaned up ${result.count} expired tokens`);
  return result.count;
}
