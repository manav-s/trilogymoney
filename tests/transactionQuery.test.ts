import { describe, it, expect } from 'vitest';

import { parseTransactionsQuery } from '../lib/transactionQuery';

describe('parseTransactionsQuery', () => {
  const fixedNow = new Date('2025-11-09T12:00:00Z');

  it('detects merchant spend for last month', () => {
    const result = parseTransactionsQuery('How much did I spend on Amazon during the last month?', fixedNow);
    expect(result.kind).toBe('merchantSpend');
    if (result.kind === 'merchantSpend') {
      expect(result.merchant?.toLowerCase()).toContain('amazon');
      expect(result.from).toBe('2025-10-01');
      expect(result.to).toBe('2025-10-31');
      expect(result.limit).toBeGreaterThan(3);
    }
  });

  it('uses merchant spend when spend keywords present even without explicit merchant', () => {
    const result = parseTransactionsQuery('Show me my recent charges', fixedNow);
    expect(result.kind).toBe('merchantSpend');
    if (result.kind === 'merchantSpend') {
      expect(result.merchant).toBeNull();
      expect(result.from).toBe('2025-10-10');
      expect(result.to).toBe('2025-11-09');
    }
  });

  it('handles past weeks phrasing', () => {
    const result = parseTransactionsQuery('total spend at Starbucks past 2 weeks', fixedNow);
    expect(result.kind).toBe('merchantSpend');
    if (result.kind === 'merchantSpend') {
      expect(result.merchant?.toLowerCase()).toContain('starbucks');
      expect(result.from).toBe('2025-10-26');
      expect(result.to).toBe('2025-11-09');
    }
  });
});


