import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDeclineResponse, getPendingJobQuestion, classifyPendingReply } from '@/lib/conversational';

// Mock fetch globally for classifyPendingReply tests
const mockFetch = vi.fn();

describe('lib/conversational', () => {
  describe('getDeclineResponse', () => {
    it('returns a string', () => {
      const response = getDeclineResponse();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });

    it('returns different responses over multiple calls (randomness)', () => {
      const responses = new Set<string>();
      // Call many times to check we get variety
      for (let i = 0; i < 50; i++) {
        responses.add(getDeclineResponse());
      }
      // Should have at least 2 different responses
      expect(responses.size).toBeGreaterThan(1);
    });
  });

  describe('getPendingJobQuestion', () => {
    it('returns balance question', () => {
      const question = getPendingJobQuestion('balance');
      expect(question).toBe("hey! wanna hear your balance?");
    });

    it('returns weekly question', () => {
      const question = getPendingJobQuestion('weekly');
      expect(question).toBe("your week in money is ready—want the recap?");
    });

    it('returns subscriptions question', () => {
      const question = getPendingJobQuestion('subscriptions');
      expect(question).toBe("want to hear your subscriptions?");
    });
  });

  describe('classifyPendingReply', () => {
    const originalEnv = process.env.OPENAI_API_KEY;
    const originalFetch = global.fetch;
    
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
      global.fetch = mockFetch;
      mockFetch.mockReset();
    });

    afterEach(() => {
      process.env.OPENAI_API_KEY = originalEnv;
      global.fetch = originalFetch;
    });

    it('returns OTHER when API key is missing', async () => {
      process.env.OPENAI_API_KEY = '';
      
      const result = await classifyPendingReply('balance', 'yes');
      
      expect(result.intent).toBe('OTHER');
      expect(result.followUp).toBe('yes');
    });

    it('returns YES for affirmative replies', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'YES' } }],
        }),
      });

      const result = await classifyPendingReply('balance', 'sure');

      expect(result.intent).toBe('YES');
      expect(result.followUp).toBeUndefined();
    });

    it('returns NO for negative replies', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'NO' } }],
        }),
      });

      const result = await classifyPendingReply('balance', 'nah');

      expect(result.intent).toBe('NO');
      expect(result.followUp).toBeUndefined();
    });

    it('returns OTHER with followUp for unrelated questions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'OTHER\nhow much did I spend at Target?' } }],
        }),
      });

      const result = await classifyPendingReply('balance', 'how much did I spend at Target?');

      expect(result.intent).toBe('OTHER');
      expect(result.followUp).toBe('how much did I spend at Target?');
    });

    it('defaults to OTHER on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await classifyPendingReply('balance', 'yes please');

      expect(result.intent).toBe('OTHER');
      expect(result.followUp).toBe('yes please');
    });

    it('defaults to OTHER on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await classifyPendingReply('balance', 'sure thing');

      expect(result.intent).toBe('OTHER');
      expect(result.followUp).toBe('sure thing');
    });

    it('defaults to OTHER on empty response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '' } }],
        }),
      });

      const result = await classifyPendingReply('balance', 'yeah');

      expect(result.intent).toBe('OTHER');
    });

    it('handles unexpected LLM output gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'MAYBE' } }],
        }),
      });

      const result = await classifyPendingReply('balance', 'idk');

      // MAYBE is not YES or NO, so should be OTHER
      expect(result.intent).toBe('OTHER');
    });
  });
});
