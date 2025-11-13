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
      expect(result.from).toBe('2025-11-02');
      expect(result.to).toBe('2025-11-09');
    }
  });

  it('detects current month when user asks for just that month', () => {
    const result = parseTransactionsQuery('just november spending', fixedNow);
    expect(result.kind).toBe('merchantSpend');
    if (result.kind === 'merchantSpend') {
      expect(result.from).toBe('2025-11-01');
      expect(result.to).toBe('2025-11-09');
    }
  });

  it('handles "this month" phrasing', () => {
    const result = parseTransactionsQuery('how much did i spend this month?', fixedNow);
    expect(result.kind).toBe('merchantSpend');
    if (result.kind === 'merchantSpend') {
      expect(result.from).toBe('2025-11-01');
      expect(result.to).toBe('2025-11-09');
    }
  });

  it('handles month references with explicit year', () => {
    const result = parseTransactionsQuery('show october 2024 purchases', fixedNow);
    expect(result.kind).toBe('merchantSpend');
    if (result.kind === 'merchantSpend') {
      expect(result.from).toBe('2024-10-01');
      expect(result.to).toBe('2024-10-31');
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

  it('still handles "since" phrasing with month', () => {
    const result = parseTransactionsQuery('spending since october 5', fixedNow);
    expect(result.kind).toBe('merchantSpend');
    if (result.kind === 'merchantSpend') {
      expect(result.from).toBe('2025-10-05');
      expect(result.to).toBe('2025-11-09');
    }
  });
});


