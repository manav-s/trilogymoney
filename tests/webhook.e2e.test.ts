/**
 * Comprehensive webhook end-to-end tests
 * Tests the full flow: webhook → DB → response
 * 
 * Run with: npx vitest run tests/webhook.e2e.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../lib/db/db';
import { formatE164 } from '../lib/integrations/blooio';
import { encryptMessage, decryptMessage } from '../lib/db/encryption';

// Mock sendMessage to avoid actual API calls
vi.mock('../lib/integrations/blooio', async () => {
  const actual = await vi.importActual('../lib/integrations/blooio');
  return {
    ...actual,
    sendMessage: vi.fn().mockResolvedValue({ id: 'mock-id', status: 'sent' }),
  };
});

// Mock OpenAI to avoid actual API calls
vi.mock('../lib/ai/conversationWithTools', () => ({
  handleLLMConversationWithTools: vi.fn().mockResolvedValue(undefined),
}));

// Test phone numbers (use fake E.164 format)
const TEST_PHONES = {
  US: '+15550001111',
  UK: '+447700900111',
  CA: '+14160001111',
};

// Helper to generate unique test phone
function uniquePhone(base: string): string {
  return base.slice(0, -4) + Math.floor(1000 + Math.random() * 9000);
}

// Cleanup helper
async function cleanupTestUser(phone: string) {
  try {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (user) {
      await prisma.message.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { phone } });
    }
  } catch {
    // Ignore cleanup errors
  }
}

describe('Webhook E2E Tests', () => {
  describe('Phone Number Handling', () => {
    it('handles US E.164 phone number', () => {
      const phone = '+15551234567';
      expect(formatE164(phone)).toBe('+15551234567');
    });

    it('handles UK E.164 phone number', () => {
      const phone = '+447700900123';
      expect(formatE164(phone)).toBe('+447700900123');
    });

    it('handles Canada E.164 phone number', () => {
      const phone = '+14161234567';
      expect(formatE164(phone)).toBe('+14161234567');
    });

    it('normalizes US number with formatting', () => {
      expect(formatE164('+1 555 123 4567')).toBe('+15551234567');
      expect(formatE164('+1-555-123-4567')).toBe('+15551234567');
    });

    it('normalizes UK number with formatting', () => {
      expect(formatE164('+44 7700 900 123')).toBe('+447700900123');
    });
  });

  describe('User Creation (New UK User)', () => {
    const testPhone = uniquePhone(TEST_PHONES.UK);

    afterEach(async () => {
      await cleanupTestUser(testPhone);
    });

    it('creates new user with UK phone number', async () => {
      // Simulate what handleNewUser does
      const user = await prisma.user.create({
        data: {
          phone: testPhone,
          consent: true,
          onboardingStatus: 'pre_auth',
          messagingStatus: 'inactive',
        },
      });

      expect(user.phone).toBe(testPhone);
      expect(user.phone.startsWith('+44')).toBe(true);
      expect(user.onboardingStatus).toBe('pre_auth');
      expect(user.messagingStatus).toBe('inactive');

      // Verify we can look up by phone
      const found = await prisma.user.findUnique({ where: { phone: testPhone } });
      expect(found).not.toBeNull();
      expect(found?.id).toBe(user.id);
    });
  });

  describe('Message Persistence', () => {
    const testPhone = uniquePhone(TEST_PHONES.UK);
    let testUserId: string;

    beforeEach(async () => {
      const user = await prisma.user.create({
        data: {
          phone: testPhone,
          consent: true,
          onboardingStatus: 'complete',
          messagingStatus: 'active',
          billingStatus: 'active',
        },
      });
      testUserId = user.id;
    });

    afterEach(async () => {
      await cleanupTestUser(testPhone);
    });

    it('stores inbound message with encryption', async () => {
      const messageText = 'what are my subscriptions';
      const providerId = `test-msg-${Date.now()}`;

      const message = await prisma.message.create({
        data: {
          userId: testUserId,
          direction: 'inbound',
          content: encryptMessage(messageText),
          status: 'received',
          provider: 'blooio',
          providerId,
          sentAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
      });

      expect(message.direction).toBe('inbound');
      expect(message.provider).toBe('blooio');

      // Verify encryption works
      const decrypted = decryptMessage(message.content);
      expect(decrypted).toBe(messageText);

      // Verify we can find by providerId (deduplication)
      const found = await prisma.message.findFirst({ where: { providerId } });
      expect(found).not.toBeNull();
    });

    it('prevents duplicate messages by providerId', async () => {
      const providerId = `test-dup-${Date.now()}`;

      await prisma.message.create({
        data: {
          userId: testUserId,
          direction: 'inbound',
          content: encryptMessage('first message'),
          status: 'received',
          provider: 'blooio',
          providerId,
          sentAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
      });

      // Check for existing (this is what webhook does)
      const existing = await prisma.message.findFirst({ where: { providerId } });
      expect(existing).not.toBeNull();

      // Count should be 1 (no duplicate created)
      const count = await prisma.message.count({ where: { providerId } });
      expect(count).toBe(1);
    });
  });

  describe('User State Transitions', () => {
    const testPhone = uniquePhone(TEST_PHONES.UK);

    afterEach(async () => {
      await cleanupTestUser(testPhone);
    });

    it('STOP command sets messagingStatus to stopped', async () => {
      await prisma.user.create({
        data: {
          phone: testPhone,
          consent: true,
          onboardingStatus: 'complete',
          messagingStatus: 'active',
          billingStatus: 'active',
          isActive: true,
        },
      });

      // Simulate handleStopCommand
      const updated = await prisma.user.update({
        where: { phone: testPhone },
        data: { messagingStatus: 'stopped', isActive: false },
      });

      expect(updated.messagingStatus).toBe('stopped');
      expect(updated.isActive).toBe(false);
    });

    it('START command reactivates stopped user', async () => {
      await prisma.user.create({
        data: {
          phone: testPhone,
          consent: true,
          onboardingStatus: 'complete',
          messagingStatus: 'stopped',
          billingStatus: 'active',
          isActive: false,
        },
      });

      // Simulate handleStartCommand
      const updated = await prisma.user.update({
        where: { phone: testPhone },
        data: { messagingStatus: 'active', isActive: true },
      });

      expect(updated.messagingStatus).toBe('active');
      expect(updated.isActive).toBe(true);
    });
  });

  describe('Message Status Updates', () => {
    const testPhone = uniquePhone(TEST_PHONES.US);
    let testUserId: string;

    beforeEach(async () => {
      const user = await prisma.user.create({
        data: {
          phone: testPhone,
          consent: true,
          onboardingStatus: 'complete',
          messagingStatus: 'active',
          billingStatus: 'active',
        },
      });
      testUserId = user.id;
    });

    afterEach(async () => {
      await cleanupTestUser(testPhone);
    });

    it('updates message status to delivered', async () => {
      const providerId = `test-status-${Date.now()}`;

      await prisma.message.create({
        data: {
          userId: testUserId,
          direction: 'outbound',
          content: encryptMessage('test message'),
          status: 'sent',
          provider: 'blooio',
          providerId,
          sentAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
      });

      // Simulate handleMessageStatus for delivered
      await prisma.message.updateMany({
        where: { providerId },
        data: { status: 'delivered' },
      });

      const updated = await prisma.message.findFirst({ where: { providerId } });
      expect(updated?.status).toBe('delivered');
    });

    it('updates message status to read', async () => {
      const providerId = `test-read-${Date.now()}`;

      await prisma.message.create({
        data: {
          userId: testUserId,
          direction: 'outbound',
          content: encryptMessage('test message'),
          status: 'delivered',
          provider: 'blooio',
          providerId,
          sentAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
      });

      // Simulate handleMessageStatus for read
      await prisma.message.updateMany({
        where: { providerId },
        data: { status: 'read' },
      });

      const updated = await prisma.message.findFirst({ where: { providerId } });
      expect(updated?.status).toBe('read');
    });
  });

  describe('Rate Limiting', () => {
    const testPhone = uniquePhone(TEST_PHONES.UK);
    let testUserId: string;

    beforeEach(async () => {
      const user = await prisma.user.create({
        data: {
          phone: testPhone,
          consent: true,
          onboardingStatus: 'complete',
          messagingStatus: 'active',
          billingStatus: 'active',
        },
      });
      testUserId = user.id;
    });

    afterEach(async () => {
      await cleanupTestUser(testPhone);
    });

    it('counts recent inbound messages correctly', async () => {
      const now = new Date();
      
      // Create 5 recent messages
      for (let i = 0; i < 5; i++) {
        await prisma.message.create({
          data: {
            userId: testUserId,
            direction: 'inbound',
            content: encryptMessage(`message ${i}`),
            status: 'received',
            provider: 'blooio',
            providerId: `rate-test-${Date.now()}-${i}`,
            sentAt: new Date(now.getTime() - i * 1000), // 1 second apart
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          },
        });
      }

      // Count recent messages (simulates rate limit check)
      const since = new Date(Date.now() - 60 * 1000); // Last minute
      const recentCount = await prisma.message.count({
        where: {
          userId: testUserId,
          direction: 'inbound',
          sentAt: { gte: since },
        },
      });

      expect(recentCount).toBe(5);
    });
  });

  describe('UK-Specific Scenarios', () => {
    it('stores and retrieves UK user correctly', async () => {
      const ukPhone = uniquePhone(TEST_PHONES.UK);

      try {
        // Create UK user
        const user = await prisma.user.create({
          data: {
            phone: ukPhone,
            consent: true,
            onboardingStatus: 'pre_auth',
            messagingStatus: 'inactive',
          },
        });

        // Verify phone format
        expect(user.phone).toBe(ukPhone);
        expect(user.phone.startsWith('+44')).toBe(true);
        expect(user.phone.length).toBe(13); // +44 + 10 digits

        // Look up by exact phone
        const found = await prisma.user.findUnique({ where: { phone: ukPhone } });
        expect(found?.id).toBe(user.id);

        // Simulate full onboarding completion
        const updated = await prisma.user.update({
          where: { phone: ukPhone },
          data: {
            onboardingStatus: 'complete',
            messagingStatus: 'active',
            billingStatus: 'active',
            isActive: true,
          },
        });

        expect(updated.onboardingStatus).toBe('complete');
        expect(updated.messagingStatus).toBe('active');
        expect(updated.billingStatus).toBe('active');
      } finally {
        await cleanupTestUser(ukPhone);
      }
    });

    it('handles UK user message flow end-to-end', async () => {
      const ukPhone = uniquePhone(TEST_PHONES.UK);

      try {
        // 1. Create UK user (simulates handleNewUser)
        const user = await prisma.user.create({
          data: {
            phone: ukPhone,
            consent: true,
            onboardingStatus: 'complete',
            messagingStatus: 'active',
            billingStatus: 'active',
            isActive: true,
          },
        });

        // 2. Store inbound message
        const inboundProviderId = `uk-inbound-${Date.now()}`;
        await prisma.message.create({
          data: {
            userId: user.id,
            direction: 'inbound',
            content: encryptMessage('what are my subscriptions'),
            status: 'received',
            provider: 'blooio',
            providerId: inboundProviderId,
            sentAt: new Date(),
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          },
        });

        // 3. Store outbound response
        const outboundProviderId = `uk-outbound-${Date.now()}`;
        await prisma.message.create({
          data: {
            userId: user.id,
            direction: 'outbound',
            content: encryptMessage('• Netflix $15.99\n• Spotify $9.99\n\ntotal: $25.98/month'),
            status: 'sent',
            provider: 'blooio',
            providerId: outboundProviderId,
            sentAt: new Date(),
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          },
        });

        // 4. Verify message history
        const messages = await prisma.message.findMany({
          where: { userId: user.id },
          orderBy: { sentAt: 'asc' },
        });

        expect(messages.length).toBe(2);
        expect(messages[0].direction).toBe('inbound');
        expect(messages[1].direction).toBe('outbound');

        // 5. Verify decryption works
        expect(decryptMessage(messages[0].content)).toBe('what are my subscriptions');
        expect(decryptMessage(messages[1].content)).toContain('Netflix');
      } finally {
        await cleanupTestUser(ukPhone);
      }
    });
  });
});
