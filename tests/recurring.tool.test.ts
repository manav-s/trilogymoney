import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('../lib/services/recurring', () => {
  return {
    getRecurringStreams: vi.fn(),
  };
});

import { executeToolCall } from '../lib/ai/tools';
import { getRecurringStreams } from '../lib/services/recurring';

describe('get_recurring_charges tool executor', () => {
  const toolCall = {
    id: '1',
    type: 'function' as const,
    function: { name: 'get_recurring_charges', arguments: '{}' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns top active streams sorted by amount with slim payload', async () => {
    (getRecurringStreams as unknown as Mock).mockResolvedValue([
      {
        merchant: 'B',
        amount: 20,
        frequency: 'MONTHLY',
        nextDate: '2025-12-01',
        category: 'bills',
        accountName: 'Chk',
        institutionName: 'Bank',
        status: 'MATURE',
        isActive: true,
      },
      {
        merchant: 'A',
        amount: 50,
        frequency: 'MONTHLY',
        nextDate: '2025-12-02',
        category: 'entertainment',
        accountName: 'Chk',
        institutionName: 'Bank',
        status: 'MATURE',
        isActive: true,
      },
      {
        merchant: 'C',
        amount: 10,
        frequency: 'MONTHLY',
        nextDate: '2025-12-03',
        category: 'misc',
        accountName: 'Chk',
        institutionName: 'Bank',
        status: 'TERMINATED',
        isActive: false,
      },
    ]);

    const result = (await executeToolCall('user1', toolCall)) as Array<Record<string, unknown>>;

    expect(result).toHaveLength(2);
    expect(result[0].merchant).toBe('A');
    expect(result[1].merchant).toBe('B');
    expect(result[0]).toMatchObject({
      amount: 50,
      freq: 'MONTHLY',
      next: '2025-12-02',
      cat: 'entertainment',
      acct: 'Bank - Chk',
      status: 'MATURE',
    });
  });

  it('returns message when no active streams', async () => {
    (getRecurringStreams as unknown as Mock).mockResolvedValue([
      { isActive: false },
    ]);

    const result = (await executeToolCall('user1', toolCall)) as { message?: string };
    expect(result.message).toMatch(/No active recurring charges/i);
  });
});
