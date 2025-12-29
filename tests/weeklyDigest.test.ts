import { describe, it, expect, vi, afterEach } from 'vitest';

import type { BalancesBreakdown } from '../lib/services/balances';
import type {
  TransactionSummary,
  TransactionsSummary,
  TransactionsSummaryBucket,
} from '../lib/services/transactions';
import { buildWeeklyDigestContext, extractHighlights } from '../lib/weeklyDigest';
import { splitDigestIntoMessages } from '../lib/jobs/weeklyDigestJob';
import type { WeeklyDigestContext } from '../lib/ai/llm';

function makeBucket(
  label: string,
  spendAmount: number,
  refundAmount = 0,
  options: { pendingSpend?: number; pendingRefund?: number; count?: number; pendingCount?: number } = {}
): TransactionsSummaryBucket {
  const pendingSpendAmount = options.pendingSpend ?? 0;
  const pendingRefundAmount = options.pendingRefund ?? 0;
  const pendingCount = options.pendingCount ?? 0;
  const count = options.count ?? 1;
  return {
    label,
    spendAmount,
    refundAmount,
    amount: spendAmount - refundAmount,
    pendingAmount: pendingSpendAmount - pendingRefundAmount,
    pendingSpendAmount,
    pendingRefundAmount,
    count,
    pendingCount,
  };
}

describe('weekly digest helpers', () => {
  it('extracts merchant keywords and summary-based highlights', () => {
    const summary: TransactionsSummary = {
      from: '2025-10-07',
      to: '2025-10-13',
      totalAmount: 205,
      totalSpend: 205,
      totalRefund: 25,
      pendingAmount: 15,
      pendingSpend: 15,
      pendingRefund: 0,
      totalIncome: 0,
      pendingIncome: 0,
      incomeCount: 0,
      count: 5,
      pendingCount: 1,
      perMerchant: [
        makeBucket('Amazon Marketplace', 120),
        makeBucket('Uber Eats', 30, 0, { pendingSpend: 15, pendingCount: 1 }),
        makeBucket('Local Shop', 20, 5),
      ],
      perCategory: [
        makeBucket('GENERAL_MERCHANDISE', 150),
        makeBucket('FOOD_AND_DRINK', 55),
      ],
      incomeBuckets: [],
    };

    const highlights = extractHighlights(summary);
    const highlightSet = new Set(highlights);

    expect(highlightSet).toEqual(new Set(['amazon', 'uber', 'uber_eats', 'refunds', 'pending_spend']));
  });

  it('marks no_spend when there are zero transactions and spend', () => {
    const summary: TransactionsSummary = {
      from: '2025-10-07',
      to: '2025-10-13',
      totalAmount: 0,
      totalSpend: 0,
      totalRefund: 0,
      pendingAmount: 0,
      pendingSpend: 0,
      pendingRefund: 0,
      totalIncome: 0,
      pendingIncome: 0,
      incomeCount: 0,
      count: 0,
      pendingCount: 0,
      perMerchant: [],
      perCategory: [],
      incomeBuckets: [],
    };

    expect(extractHighlights(summary)).toEqual(['no_spend']);
  });

  it('builds digest context with trimmed lists and rounded totals', () => {
    const range = { from: '2025-10-07', to: '2025-10-13' };
    const summary: TransactionsSummary = {
      from: range.from,
      to: range.to,
      totalAmount: 0,
      totalSpend: 123.456,
      totalRefund: 7.891,
      pendingAmount: 0,
      pendingSpend: 5.555,
      pendingRefund: 1.111,
      totalIncome: 0,
      pendingIncome: 0,
      incomeCount: 0,
      count: 7,
      pendingCount: 2,
      perMerchant: [
        makeBucket('Top Merchant', 400),
        makeBucket('Second Merchant', 300),
        makeBucket('Third Merchant', 200),
        makeBucket('Fourth Merchant', 150),
        makeBucket('Fifth Merchant', 75),
        makeBucket('Sixth Merchant', 60),
      ],
      perCategory: [
        makeBucket('CATEGORY_A', 500),
        makeBucket('CATEGORY_B', 250),
        makeBucket('CATEGORY_C', 200),
        makeBucket('CATEGORY_D', 150),
        makeBucket('CATEGORY_E', 80),
        makeBucket('CATEGORY_F', 40),
      ],
      incomeBuckets: [],
    };

    const transactions: TransactionSummary[] = [
      { id: 't1', date: '2025-10-10', amount: 200, currency: 'USD', merchant: 'A', description: 'A', category: 'CATEGORY_A', pending: false, account: { id: 'acct1', name: 'Checking', institution: 'Bank', mask: '1111' } },
      { id: 't2', date: '2025-10-09', amount: 180, currency: 'USD', merchant: 'B', description: 'B', category: 'CATEGORY_B', pending: true, account: { id: 'acct1', name: 'Checking', institution: 'Bank', mask: '1111' } },
      { id: 't3', date: '2025-10-08', amount: 160, currency: 'USD', merchant: 'C', description: 'C', category: 'CATEGORY_C', pending: false, account: { id: 'acct1', name: 'Checking', institution: 'Bank', mask: '1111' } },
      { id: 't4', date: '2025-10-07', amount: 140, currency: 'USD', merchant: 'D', description: 'D', category: 'CATEGORY_D', pending: false, account: { id: 'acct1', name: 'Checking', institution: 'Bank', mask: '1111' } },
      { id: 't5', date: '2025-10-11', amount: 120, currency: 'USD', merchant: 'E', description: 'E', category: 'CATEGORY_E', pending: false, account: { id: 'acct1', name: 'Checking', institution: 'Bank', mask: '1111' } },
      { id: 't6', date: '2025-10-12', amount: 90, currency: 'USD', merchant: 'F', description: 'F', category: 'CATEGORY_F', pending: false, account: { id: 'acct1', name: 'Checking', institution: 'Bank', mask: '1111' } },
      { id: 'r1', date: '2025-10-13', amount: -80, currency: 'USD', merchant: 'Refund One', description: 'Refund', category: 'CATEGORY_A', pending: false, account: { id: 'acct1', name: 'Checking', institution: 'Bank', mask: '1111' } },
      { id: 'r2', date: '2025-10-14', amount: -60, currency: 'USD', merchant: 'Refund Two', description: 'Refund', category: 'CATEGORY_B', pending: false, account: { id: 'acct1', name: 'Checking', institution: 'Bank', mask: '1111' } },
      { id: 'r3', date: '2025-10-15', amount: -40, currency: 'USD', merchant: 'Refund Three', description: 'Refund', category: 'CATEGORY_C', pending: false, account: { id: 'acct1', name: 'Checking', institution: 'Bank', mask: '1111' } },
      { id: 'r4', date: '2025-10-16', amount: -20, currency: 'USD', merchant: 'Refund Four', description: 'Refund', category: 'CATEGORY_D', pending: true, account: { id: 'acct1', name: 'Checking', institution: 'Bank', mask: '1111' } },
    ];

    const balances: BalancesBreakdown = {
      cash: {
        total: 4321.987,
        count: 6,
        accounts: [
          { id: 'c1', accountId: 'c1', name: 'Cash 1', type: 'depository', mask: '0001', subtype: 'checking', institution: 'Bank', currency: 'USD', current: 1000, available: 900, updatedAt: null },
          { id: 'c2', accountId: 'c2', name: 'Cash 2', type: 'depository', mask: '0002', subtype: 'savings', institution: 'Bank', currency: 'USD', current: 800, available: 750, updatedAt: null },
          { id: 'c3', accountId: 'c3', name: 'Cash 3', type: 'depository', mask: '0003', subtype: 'checking', institution: 'Bank', currency: 'USD', current: 600, available: 580, updatedAt: null },
          { id: 'c4', accountId: 'c4', name: 'Cash 4', type: 'depository', mask: '0004', subtype: 'checking', institution: 'Bank', currency: 'USD', current: 400, available: 390, updatedAt: null },
          { id: 'c5', accountId: 'c5', name: 'Cash 5', type: 'depository', mask: '0005', subtype: 'checking', institution: 'Bank', currency: 'USD', current: 300, available: 295, updatedAt: null },
          { id: 'c6', accountId: 'c6', name: 'Cash 6', type: 'depository', mask: '0006', subtype: 'checking', institution: 'Bank', currency: 'USD', current: 200, available: 190, updatedAt: null },
        ],
      },
      credit: {
        owedTotal: 987.654,
        count: 6,
        accounts: [
          { id: 'cc1', accountId: 'cc1', name: 'Card 1', type: 'credit', mask: '1001', subtype: 'credit card', institution: 'Card', currency: 'USD', current: -400, available: null, updatedAt: null },
          { id: 'cc2', accountId: 'cc2', name: 'Card 2', type: 'credit', mask: '1002', subtype: 'credit card', institution: 'Card', currency: 'USD', current: -350, available: null, updatedAt: null },
          { id: 'cc3', accountId: 'cc3', name: 'Card 3', type: 'credit', mask: '1003', subtype: 'credit card', institution: 'Card', currency: 'USD', current: -300, available: null, updatedAt: null },
          { id: 'cc4', accountId: 'cc4', name: 'Card 4', type: 'credit', mask: '1004', subtype: 'credit card', institution: 'Card', currency: 'USD', current: -250, available: null, updatedAt: null },
          { id: 'cc5', accountId: 'cc5', name: 'Card 5', type: 'credit', mask: '1005', subtype: 'credit card', institution: 'Card', currency: 'USD', current: -200, available: null, updatedAt: null },
          { id: 'cc6', accountId: 'cc6', name: 'Card 6', type: 'credit', mask: '1006', subtype: 'credit card', institution: 'Card', currency: 'USD', current: -150, available: null, updatedAt: null },
        ],
      },
    };

    const context = buildWeeklyDigestContext({
      summary,
      transactions,
      balances,
      timezone: 'America/Los_Angeles',
      range,
      highlights: ['amazon'],
    });

    expect(context.week).toEqual(range);
    expect(context.spendSummary.totalSpend).toBeCloseTo(123.46);
    expect(context.spendSummary.pendingSpend).toBeCloseTo(5.56);
    expect(context.spendSummary.topCategories).toHaveLength(5);
    expect(context.spendSummary.topMerchants).toHaveLength(5);
    expect(context.spendSummary.topTransactions).toHaveLength(5);
    expect(context.spendSummary.topTransactions[0].amount).toBe(200);
    expect(context.balances.cashAccounts).toHaveLength(balances.cash.accounts.length);
    expect(context.balances.creditAccounts).toHaveLength(balances.credit.accounts.length);
    expect(context.balances.cashTotal).toBeCloseTo(4321.99);
    expect(context.balances.creditOwedTotal).toBeCloseTo(987.65);
    expect(context.highlights).toEqual(['amazon']);
  });
});

describe('generateWeeklyDigestMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends context JSON to OpenAI and returns the response text', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    vi.resetModules();
    const { generateWeeklyDigestMessage } = await import('../lib/ai/llm');

    const context: WeeklyDigestContext = {
      week: { from: '2025-10-07', to: '2025-10-13' },
      timezone: 'America/Los_Angeles',
      spendSummary: {
        totalSpend: 200,
        pendingSpend: 0,
        count: 4,
        pendingCount: 0,
        topCategories: [{ label: 'FOOD_AND_DRINK', spendAmount: 120, refundAmount: 10, count: 2 }],
        topMerchants: [{ label: 'Starbucks', spendAmount: 60, refundAmount: 0, count: 2 }],
        topTransactions: [{ merchant: 'Starbucks', amount: 30, date: '2025-10-10', category: 'FOOD_AND_DRINK', pending: false }],
      },
      balances: {
        cashTotal: 1500,
        cashCount: 2,
        cashAccounts: [{ name: 'Checking', institution: 'Bank', available: 800, current: 820, mask: '1111' }],
        creditOwedTotal: 300,
        creditCount: 1,
        creditAccounts: [{ name: 'Card', institution: 'Card Co', balance: 300, mask: '2222' }],
      },
      highlights: ['starbucks'],
    };

    const fetchMock = vi.fn(async (_url: RequestInfo, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const prompt = body.messages?.[1]?.content ?? '';
      expect(prompt).toContain('JSON:');
      expect(prompt).toContain('"totalSpend":200');
      expect(prompt).toContain('Add a blank line after the heading');
      expect(prompt).toContain('category breakdown:');
      expect(prompt).toContain('pending to watch');
      expect(prompt).toContain('write "balances:" on its own line');
      expect(prompt).toContain('lowercase with spaces instead of underscores');
      expect(prompt).toContain('judgy poke');
      expect(prompt).toContain('weekly summary: nov 17 → nov 23');
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'weekly vibe secured' } }] }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const message = await generateWeeklyDigestMessage(context);
    expect(message).toBe('weekly vibe secured');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    delete process.env.OPENAI_API_KEY;
  });
});

describe('splitDigestIntoMessages', () => {
  it('splits on blank lines between sections', () => {
    const message = `weekly summary: dec 22 → dec 28

you spent a total of $223 this week.

category breakdown:
🛍️ general merchandise $148 — Tesla Motors, Amazon
🚗 transportation $75 — E-zpass Rebill Ezp

pending to watch: $28 still clearing.

balances:
td convenience checking 16299.98`;

    const parts = splitDigestIntoMessages(message);
    expect(parts).toEqual([
      'weekly summary: dec 22 → dec 28',
      'you spent a total of $223 this week.',
      'category breakdown:\n🛍️ general merchandise $148 — Tesla Motors, Amazon\n🚗 transportation $75 — E-zpass Rebill Ezp',
      'pending to watch: $28 still clearing.',
      'balances:\ntd convenience checking 16299.98',
    ]);
  });

  it('preserves em-dashes within category lines', () => {
    const message = `weekly summary: dec 22 → dec 28

category breakdown:
🍽️ food and drink $121 — dishoom, ssp london
🚇 transportation $45 — uber, lyft`;

    const parts = splitDigestIntoMessages(message);
    expect(parts).toHaveLength(2);
    expect(parts[1]).toContain('🍽️ food and drink $121 — dishoom, ssp london');
    expect(parts[1]).toContain('🚇 transportation $45 — uber, lyft');
  });

  it('handles multiple blank lines as single separator', () => {
    const message = `heading


body text



footer`;

    const parts = splitDigestIntoMessages(message);
    expect(parts).toEqual(['heading', 'body text', 'footer']);
  });

  it('trims whitespace from each part', () => {
    const message = `  heading with spaces  

  body with spaces  `;

    const parts = splitDigestIntoMessages(message);
    expect(parts).toEqual(['heading with spaces', 'body with spaces']);
  });

  it('filters out empty parts', () => {
    const message = `heading

   

body`;

    const parts = splitDigestIntoMessages(message);
    expect(parts).toEqual(['heading', 'body']);
  });

  it('handles single line message', () => {
    const parts = splitDigestIntoMessages('just one line');
    expect(parts).toEqual(['just one line']);
  });

  it('handles message with no blank lines', () => {
    const message = `line one
line two
line three`;

    const parts = splitDigestIntoMessages(message);
    expect(parts).toEqual(['line one\nline two\nline three']);
  });
});
