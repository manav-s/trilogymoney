import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  selectVariant,
  buildMidweekContext,
  formatCategoryLabel,
  type MidweekVariant,
} from '../lib/midweekCheckin';
import type { TransactionsSummary, TransactionsSummaryBucket, TransactionSummary } from '../lib/services/transactions';

function makeBucket(
  label: string,
  spendAmount: number,
  options: { refundAmount?: number; count?: number; pendingSpend?: number; pendingCount?: number } = {}
): TransactionsSummaryBucket {
  const { refundAmount = 0, count = 1, pendingSpend = 0, pendingCount = 0 } = options;
  return {
    label,
    spendAmount,
    refundAmount,
    amount: spendAmount - refundAmount,
    pendingAmount: pendingSpend,
    pendingSpendAmount: pendingSpend,
    pendingRefundAmount: 0,
    count,
    pendingCount,
  };
}

function makeSummary(overrides: Partial<TransactionsSummary> = {}): TransactionsSummary {
  return {
    from: '2025-12-23',
    to: '2025-12-25',
    totalAmount: 100,
    totalSpend: 100,
    totalRefund: 0,
    pendingAmount: 0,
    pendingSpend: 0,
    pendingRefund: 0,
    totalIncome: 0,
    pendingIncome: 0,
    incomeCount: 0,
    count: 3,
    pendingCount: 0,
    perMerchant: [],
    perCategory: [],
    incomeBuckets: [],
    ...overrides,
  };
}

describe('selectVariant', () => {
  it('returns pending when pendingTotal > $50', () => {
    const variant = selectVariant({
      currentWeekSpend: 200,
      pendingTotal: 75,
      topCategory: { label: 'FOOD_AND_DRINK', amount: 80 },
      biggestTransaction: { merchant: 'Amazon', amount: 50 },
      categoryAvgMonthly: { FOOD_AND_DRINK: 60 },
    });
    expect(variant).toBe('pending');
  });

  it('returns spike when category > 2x monthly average and > $30', () => {
    const variant = selectVariant({
      currentWeekSpend: 200,
      pendingTotal: 10,
      topCategory: { label: 'FOOD_AND_DRINK', amount: 150 },
      biggestTransaction: { merchant: 'Amazon', amount: 50 },
      categoryAvgMonthly: { FOOD_AND_DRINK: 60 },
    });
    expect(variant).toBe('spike');
  });

  it('does not return spike if amount <= $30 even if > 2x average', () => {
    const variant = selectVariant({
      currentWeekSpend: 25, // < $50 so will be quiet
      pendingTotal: 0,
      topCategory: { label: 'FOOD_AND_DRINK', amount: 25 },
      biggestTransaction: null,
      categoryAvgMonthly: { FOOD_AND_DRINK: 10 },
    });
    expect(variant).toBe('quiet'); // Falls through to quiet since spend < $50
  });

  it('returns big_txn when biggest transaction > $100', () => {
    const variant = selectVariant({
      currentWeekSpend: 200,
      pendingTotal: 10,
      topCategory: { label: 'FOOD_AND_DRINK', amount: 80 },
      biggestTransaction: { merchant: 'Best Buy', amount: 156 },
      categoryAvgMonthly: { FOOD_AND_DRINK: 60 },
    });
    expect(variant).toBe('big_txn');
  });

  it('returns quiet when currentWeekSpend < $50', () => {
    const variant = selectVariant({
      currentWeekSpend: 34,
      pendingTotal: 0,
      topCategory: null,
      biggestTransaction: null,
      categoryAvgMonthly: {},
    });
    expect(variant).toBe('quiet');
  });

  it('returns pace as default', () => {
    const variant = selectVariant({
      currentWeekSpend: 247,
      pendingTotal: 20,
      topCategory: { label: 'FOOD_AND_DRINK', amount: 80 },
      biggestTransaction: { merchant: 'Grocery Store', amount: 60 },
      categoryAvgMonthly: { FOOD_AND_DRINK: 70 },
    });
    expect(variant).toBe('pace');
  });

  it('prioritizes pending over spike', () => {
    const variant = selectVariant({
      currentWeekSpend: 200,
      pendingTotal: 100,
      topCategory: { label: 'FOOD_AND_DRINK', amount: 150 },
      biggestTransaction: { merchant: 'Best Buy', amount: 200 },
      categoryAvgMonthly: { FOOD_AND_DRINK: 50 },
    });
    expect(variant).toBe('pending');
  });

  it('prioritizes spike over big_txn', () => {
    const variant = selectVariant({
      currentWeekSpend: 300,
      pendingTotal: 10,
      topCategory: { label: 'ENTERTAINMENT', amount: 200 },
      biggestTransaction: { merchant: 'Best Buy', amount: 150 },
      categoryAvgMonthly: { ENTERTAINMENT: 50 },
    });
    expect(variant).toBe('spike');
  });
});

describe('buildMidweekContext', () => {
  it('builds context with correct variant and rounded values', () => {
    const currentWeekSummary = makeSummary({
      totalSpend: 123.456,
      pendingSpend: 25.789,
      count: 5,
      perCategory: [
        makeBucket('FOOD_AND_DRINK', 80.123),
        makeBucket('TRANSPORTATION', 43.333),
      ],
    });

    const currentWeekTransactions: TransactionSummary[] = [
      {
        id: 't1',
        date: '2025-12-24',
        amount: 65.50,
        currency: 'USD',
        merchant: 'Amazon',
        description: 'Amazon Purchase',
        category: 'GENERAL_MERCHANDISE',
        pending: false,
        account: { id: 'a1', name: 'Checking', institution: 'Bank', mask: '1234' },
      },
      {
        id: 't2',
        date: '2025-12-25',
        amount: 35.25,
        currency: 'USD',
        merchant: 'Uber Eats',
        description: 'Uber Eats',
        category: 'FOOD_AND_DRINK',
        pending: false,
        account: { id: 'a1', name: 'Checking', institution: 'Bank', mask: '1234' },
      },
    ];

    const lastWeekByWednesdaySummary = makeSummary({ totalSpend: 150.999 });
    const last4WeeksSummary = makeSummary({
      perCategory: [
        makeBucket('FOOD_AND_DRINK', 240), // 240/4 = 60/week avg
        makeBucket('TRANSPORTATION', 120), // 120/4 = 30/week avg
      ],
    });

    const context = buildMidweekContext({
      currentWeekSummary,
      currentWeekTransactions,
      lastWeekByWednesdaySummary,
      last4WeeksSummary,
      timezone: 'America/New_York',
    });

    expect(context.currentWeekSpend).toBeCloseTo(123.46);
    expect(context.pendingTotal).toBeCloseTo(25.79);
    expect(context.lastWeekByWednesday).toBeCloseTo(151);
    expect(context.topCategory?.label).toBe('FOOD_AND_DRINK');
    expect(context.topCategory?.amount).toBeCloseTo(80.12);
    expect(context.biggestTransaction?.merchant).toBe('Amazon');
    expect(context.biggestTransaction?.amount).toBeCloseTo(65.5);
    expect(context.categoryAvgMonthly['FOOD_AND_DRINK']).toBe(60);
    expect(context.categoryAvgMonthly['TRANSPORTATION']).toBe(30);
    expect(context.timezone).toBe('America/New_York');
    expect(context.variant).toBe('pace'); // Default since no special conditions
  });

  it('excludes transfer categories from topCategory', () => {
    const currentWeekSummary = makeSummary({
      totalSpend: 500,
      perCategory: [
        makeBucket('TRANSFER_OUT', 400),
        makeBucket('FOOD_AND_DRINK', 100),
      ],
    });

    const context = buildMidweekContext({
      currentWeekSummary,
      currentWeekTransactions: [],
      lastWeekByWednesdaySummary: null,
      last4WeeksSummary: null,
      timezone: 'UTC',
    });

    expect(context.topCategory?.label).toBe('FOOD_AND_DRINK');
    expect(context.topCategory?.amount).toBe(100);
  });

  it('handles null comparison data gracefully', () => {
    const currentWeekSummary = makeSummary({ totalSpend: 30 });

    const context = buildMidweekContext({
      currentWeekSummary,
      currentWeekTransactions: [],
      lastWeekByWednesdaySummary: null,
      last4WeeksSummary: null,
      timezone: 'UTC',
    });

    expect(context.lastWeekByWednesday).toBe(0);
    expect(context.categoryAvgMonthly).toEqual({});
    expect(context.variant).toBe('quiet');
  });

  it('finds biggest non-pending transaction', () => {
    const currentWeekTransactions: TransactionSummary[] = [
      {
        id: 't1',
        date: '2025-12-24',
        amount: 200,
        currency: 'USD',
        merchant: 'Pending Store',
        description: 'Pending',
        category: 'GENERAL_MERCHANDISE',
        pending: true,
        account: { id: 'a1', name: 'Checking', institution: 'Bank', mask: '1234' },
      },
      {
        id: 't2',
        date: '2025-12-24',
        amount: 150,
        currency: 'USD',
        merchant: 'Best Buy',
        description: 'Best Buy',
        category: 'GENERAL_MERCHANDISE',
        pending: false,
        account: { id: 'a1', name: 'Checking', institution: 'Bank', mask: '1234' },
      },
    ];

    const context = buildMidweekContext({
      currentWeekSummary: makeSummary({ totalSpend: 350 }),
      currentWeekTransactions,
      lastWeekByWednesdaySummary: null,
      last4WeeksSummary: null,
      timezone: 'UTC',
    });

    // Should pick Best Buy ($150) not Pending Store ($200)
    expect(context.biggestTransaction?.merchant).toBe('Best Buy');
    expect(context.biggestTransaction?.amount).toBe(150);
  });
});

describe('formatCategoryLabel', () => {
  it('converts to lowercase and replaces underscores with spaces', () => {
    expect(formatCategoryLabel('FOOD_AND_DRINK')).toBe('food and drink');
    expect(formatCategoryLabel('GENERAL_MERCHANDISE')).toBe('general merchandise');
    expect(formatCategoryLabel('TRANSPORTATION')).toBe('transportation');
  });
});

describe('generateMidweekMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls OpenAI with correct prompt structure', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    vi.resetModules();
    const { generateMidweekMessage } = await import('../lib/ai/llm');

    const context = {
      currentWeekSpend: 247,
      currentWeekCount: 8,
      topCategory: { label: 'FOOD_AND_DRINK', amount: 120 },
      biggestTransaction: { merchant: 'Whole Foods', amount: 85, category: 'FOOD_AND_DRINK' },
      pendingTotal: 30,
      lastWeekByWednesday: 312,
      categoryAvgMonthly: { FOOD_AND_DRINK: 80 },
      variant: 'pace' as const,
      timezone: 'America/New_York',
    };

    const fetchMock = vi.fn(async (_url: RequestInfo, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const prompt = body.messages?.[1]?.content ?? '';
      
      // Verify prompt contains key elements
      expect(prompt).toContain('midweek check-in SMS');
      expect(prompt).toContain('pace check');
      expect(prompt).toContain('$247');
      expect(prompt).toContain('$312');
      expect(prompt).toContain('JSON:');
      
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'midweek pulse: $247 so far, last week you were at $312 by now, pacing well 👀' } }] }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const message = await generateMidweekMessage(context);
    expect(message).toContain('midweek pulse');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    delete process.env.OPENAI_API_KEY;
  });

  it('returns null when API key is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();
    const { generateMidweekMessage } = await import('../lib/ai/llm');

    const context = {
      currentWeekSpend: 100,
      currentWeekCount: 3,
      topCategory: null,
      biggestTransaction: null,
      pendingTotal: 0,
      lastWeekByWednesday: 150,
      categoryAvgMonthly: {},
      variant: 'pace' as const,
      timezone: 'UTC',
    };

    const message = await generateMidweekMessage(context);
    expect(message).toBeNull();
  });
});
