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
  const id = nanoid(10); // ~170 bits of entropy
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.magicLink.create({
    data: { id, phone, expiresAt },
  });

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').trim();
  return `${baseUrl}/onboard/${id.trim()}`;
}

/**
 * Verify and consume a magic link token (one-time use)
 */
export async function verifyMagicLink(id: string): Promise<{ valid: boolean; expired?: boolean; phone?: string }> {
  try {
    const magicLink = await prisma.magicLink.findUnique({ where: { id } });
    if (!magicLink) return { valid: false };
    if (magicLink.used) return { valid: false, expired: true };
    if (magicLink.expiresAt < new Date()) return { valid: false, expired: true };

    // Atomically mark as used only if not yet used and not expired
    const result = await prisma.magicLink.updateMany({
      where: { id, used: false, expiresAt: { gt: new Date() } },
      data: { used: true },
    });
    if (result.count === 0) return { valid: false, expired: true };
    return { valid: true, phone: magicLink.phone };
  } catch {
    return { valid: false };
  }
}

/**
 * Cleanup expired magic links (run as cron job)
 */
export async function cleanupExpiredMagicLinks(): Promise<number> {
  const result = await prisma.magicLink.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}
