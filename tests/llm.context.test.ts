import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  TransactionSummary,
  TransactionsSummary,
  TransactionsSummaryBucket,
} from '../lib/transactions';

function mockFetchCapture(bodyHandler: (json: any) => void) {
  const fn = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
    const json = init?.body ? JSON.parse(String(init.body)) : {};
    bodyHandler(json);
    return new Response(JSON.stringify({ choices: [ { message: { content: 'ok' } } ] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  // @ts-expect-error mutate global for tests
  global.fetch = fn;
  return fn;
}

type BucketAccumulator = {
  label: string;
  amount: number;
  spendAmount: number;
  refundAmount: number;
  pendingAmount: number;
  pendingSpendAmount: number;
  pendingRefundAmount: number;
  count: number;
  pendingCount: number;
};

const TEST_EXCLUDED_SUMMARY_CATEGORY_VALUES = new Set([
  'transfer_in',
  'transfer_out',
  'loan_payments',
  'bank_fees',
  'service_charges',
  'interest',
  'income',
  'payroll',
  'investment_and_retirement_income',
  'cash_advance',
  'cash_withdrawal',
  'credit_card_payment',
  'credit_card_bill_payment',
  'payment',
  'mortgage',
  'deposit',
]);

const TEST_EXCLUDED_SUMMARY_CATEGORY_PREFIXES = [
  'transfer_in',
  'transfer_out',
  'loan_payments',
  'cash_advance',
  'cash_withdrawal',
  'credit_card_payment',
  'credit_card_bill_payment',
  'investment_and_retirement_income',
];

function roundAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isExcludedCategory(category?: string | null): boolean {
  if (!category) return false;
  const key = category.trim().toLowerCase();
  if (!key) return false;
  if (TEST_EXCLUDED_SUMMARY_CATEGORY_VALUES.has(key)) return true;
  return TEST_EXCLUDED_SUMMARY_CATEGORY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function accumulateBucketTotals(
  map: Map<string, BucketAccumulator>,
  key: string,
  label: string,
  txn: TransactionSummary
) {
  if (!map.has(key)) {
    map.set(key, {
      label,
      amount: 0,
      spendAmount: 0,
      refundAmount: 0,
      pendingAmount: 0,
      pendingSpendAmount: 0,
      pendingRefundAmount: 0,
      count: 0,
      pendingCount: 0,
    });
  }
  const bucket = map.get(key)!;
  bucket.amount += txn.amount;
  if (txn.amount >= 0) {
    bucket.spendAmount += txn.amount;
    if (txn.pending) bucket.pendingSpendAmount += txn.amount;
  } else {
    const abs = Math.abs(txn.amount);
    bucket.refundAmount += abs;
    if (txn.pending) bucket.pendingRefundAmount += abs;
  }
  if (txn.pending) {
    bucket.pendingAmount += txn.amount;
    bucket.pendingCount += 1;
  }
  bucket.count += 1;
}

function finalizeBucketTotals(map: Map<string, BucketAccumulator>): TransactionsSummaryBucket[] {
  return Array.from(map.values())
    .map((bucket) => ({
      label: bucket.label,
      amount: roundAmount(bucket.amount),
      spendAmount: roundAmount(bucket.spendAmount),
      refundAmount: roundAmount(bucket.refundAmount),
      pendingAmount: roundAmount(bucket.pendingAmount),
      pendingSpendAmount: roundAmount(bucket.pendingSpendAmount),
      pendingRefundAmount: roundAmount(bucket.pendingRefundAmount),
      count: bucket.count,
      pendingCount: bucket.pendingCount,
    }))
    .sort((a, b) => {
      const spendDelta = b.spendAmount - a.spendAmount;
      if (Math.abs(spendDelta) > 1e-6) return spendDelta;
      const refundDelta = b.refundAmount - a.refundAmount;
      if (Math.abs(refundDelta) > 1e-6) return refundDelta;
      const countDelta = b.count - a.count;
      if (countDelta !== 0) return countDelta;
      return a.label.localeCompare(b.label);
    });
}

function computeSummaryForFixture(
  transactions: TransactionSummary[],
  range: { from: string; to: string }
): TransactionsSummary {
  let totalAmount = 0;
  let totalSpend = 0;
  let totalRefund = 0;
  let pendingAmount = 0;
  let pendingSpend = 0;
  let pendingRefund = 0;
  let count = 0;
  let pendingCount = 0;
  const merchantMap = new Map<string, BucketAccumulator>();
  const categoryMap = new Map<string, BucketAccumulator>();

  for (const txn of transactions) {
    if (isExcludedCategory(txn.category)) continue;

    totalAmount += txn.amount;
    if (txn.amount >= 0) {
      totalSpend += txn.amount;
      if (txn.pending) pendingSpend += txn.amount;
    } else {
      const abs = Math.abs(txn.amount);
      totalRefund += abs;
      if (txn.pending) pendingRefund += abs;
    }
    if (txn.pending) {
      pendingAmount += txn.amount;
      pendingCount += 1;
    }
    count += 1;

    const merchantKey =
      txn.merchant?.trim().toLowerCase() ||
      txn.description?.trim().toLowerCase() ||
      'unknown';
    const merchantLabel = txn.merchant?.trim() || txn.description?.trim() || 'unknown merchant';
    accumulateBucketTotals(merchantMap, merchantKey, merchantLabel, txn);

    const categoryKey = txn.category?.trim().toLowerCase() || 'uncategorized';
    const categoryLabel = txn.category?.trim() || 'uncategorized';
    accumulateBucketTotals(categoryMap, categoryKey, categoryLabel, txn);
  }

  return {
    from: range.from,
    to: range.to,
    totalAmount: roundAmount(totalAmount),
    totalSpend: roundAmount(totalSpend),
    totalRefund: roundAmount(totalRefund),
    pendingAmount: roundAmount(pendingAmount),
    pendingSpend: roundAmount(pendingSpend),
    pendingRefund: roundAmount(pendingRefund),
    count,
    pendingCount,
    perMerchant: finalizeBucketTotals(merchantMap),
    perCategory: finalizeBucketTotals(categoryMap),
  };
}

function buildLargeTransactionFixture(): {
  transactions: TransactionSummary[];
  summary: TransactionsSummary;
} {
  const range = { from: '2025-10-01', to: '2025-10-31' };
  const merchants = [
    { label: 'Alpha Groceries', category: 'FOOD_AND_DRINK' },
    { label: 'Zeta Market', category: 'GENERAL_MERCHANDISE' },
    { label: 'Orion Travel', category: 'TRAVEL' },
    { label: 'Nova Fitness', category: 'PERSONAL_CARE' },
    { label: 'Lambda Services', category: 'GENERAL_SERVICES' },
    { label: 'Helios Hardware', category: 'HOME_IMPROVEMENT' },
  ];
  const accounts = [
    { id: 'acct-1', name: 'Mock Checking 001', institution: 'Mock Bank', mask: '1001' },
    { id: 'acct-2', name: 'Mock Credit 002', institution: 'Mock Card', mask: '2002' },
  ];

  const transactions: TransactionSummary[] = [];

  for (let i = 0; i < 120; i++) {
    const merchant = merchants[i % merchants.length];
    const account = accounts[i % accounts.length];
    const day = String((i % 31) + 1).padStart(2, '0');
    const date = `2025-10-${day}`;
    const isRefund = i % 11 === 3;
    let amount =
      (isRefund ? -1 : 1) *
      roundAmount(18 + (i % 7) * 3 + (i % 5) * 0.25);
    const pending = i % 9 === 5 || (isRefund && i % 13 === 0);
    let category = merchant.category;
    if (i % 17 === 0) {
      category = 'TRANSFER_OUT';
    }
    const merchantName = i % 14 === 0 ? null : merchant.label;
    const description = `${merchant.label} purchase ${i}`;

    transactions.push({
      id: `tx-${i}`,
      date,
      amount,
      currency: 'USD',
      merchant: merchantName,
      description,
      category,
      pending,
      account: {
        id: account.id,
        name: account.name,
        institution: account.institution,
        mask: account.mask,
      },
    });
  }

  const summary = computeSummaryForFixture(transactions, range);

  return { transactions, summary };
}

describe('llm prompt includes onboarding context', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('injects profile, quizAnswers, and analysisSummary', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    let capturedUserContent = '';
    mockFetchCapture((json) => {
      const msgs = json?.messages ?? [];
      const userMsg = msgs.find((m: any) => m.role === 'user');
      capturedUserContent = userMsg?.content || '';
    });

    const { generateReply } = await import('../lib/llm');
    const out = await generateReply('chat' as any, {
      userText: 'hi',
      history: 'you: hi',
      profile: { name: 'Alex', timezone: 'America/New_York', preferredTime: '08:00' },
      quizAnswers: { goal: 'save', risk: 'low' },
      analysisSummary: { score: 7, bullets: ['stable cash flow'] },
    });

    expect(out).toBe('ok');
    expect(capturedUserContent).toContain('Profile: name=Alex');
    expect(capturedUserContent).toContain('tz=America/New_York');
    expect(capturedUserContent).toContain('Quiz:');
    expect(capturedUserContent).toContain('Analysis:');
  });

  it('truncates very long quiz/analysis blobs', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    let capturedUserContent = '';
    mockFetchCapture((json) => {
      const msgs = json?.messages ?? [];
      const userMsg = msgs.find((m: any) => m.role === 'user');
      capturedUserContent = userMsg?.content || '';
    });

    const veryLong = 'x'.repeat(1000);
    const { generateReply } = await import('../lib/llm');
    await generateReply('chat' as any, {
      userText: 'hello',
      history: '',
      quizAnswers: { note: veryLong },
      analysisSummary: { note: veryLong },
    });

    // should include an ellipsis to indicate truncation
    expect(capturedUserContent).toContain('…');
  });

  it('formats transactions prompt with context', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    let capturedUserContent = '';
    mockFetchCapture((json) => {
      const msgs = json?.messages ?? [];
      const userMsg = msgs.find((m: any) => m.role === 'user');
      capturedUserContent = userMsg?.content || '';
    });

    const { generateReply } = await import('../lib/llm');
    const out = await generateReply('transactions' as any, {
      transactions: [
        {
          id: 'tx-1',
          date: '2025-11-05',
          amount: 42.13,
          currency: 'USD',
          merchant: 'CVS',
          description: 'CVS STORE',
          category: 'HEALTHCARE',
          pending: false,
          account: { id: 'acc-1', name: 'Checking', institution: 'Bank', mask: '1234' },
        },
      ],
      moreAvailable: true,
      history: 'you: hi',
      userText: 'show recent charges',
      profile: { name: 'Alex' },
      query: { kind: 'merchantSpend', limit: 100, merchant: 'Amazon', from: '2025-10-01', to: '2025-10-31' },
      summaryJson: JSON.stringify({
        from: '2025-10-01',
        to: '2025-10-31',
        totalAmount: 42.13,
        totalSpend: 42.13,
        totalRefund: 0,
        pendingAmount: 0,
        pendingSpend: 0,
        pendingRefund: 0,
        count: 1,
        pendingCount: 0,
        perMerchant: [{
          label: 'CVS',
          amount: 42.13,
          spendAmount: 42.13,
          refundAmount: 0,
          pendingAmount: 0,
          pendingSpendAmount: 0,
          pendingRefundAmount: 0,
          count: 1,
          pendingCount: 0,
        }],
        perCategory: [{
          label: 'HEALTHCARE',
          amount: 42.13,
          spendAmount: 42.13,
          refundAmount: 0,
          pendingAmount: 0,
          pendingSpendAmount: 0,
          pendingRefundAmount: 0,
          count: 1,
          pendingCount: 0,
        }],
      }),
    });

    expect(out).toBe('ok');
    expect(out).toBe('ok');
    expect(capturedUserContent).toContain('Respond with 1–2 short sentences');
    expect(capturedUserContent).toContain('summary.totalSpend');
    expect(capturedUserContent).toContain('summary.totalRefund');
    expect(capturedUserContent).toContain('summary.pendingSpend');
    expect(capturedUserContent).toContain('User question: "show recent charges".');
    expect(capturedUserContent).toContain('more_available: true');
    expect(capturedUserContent).toContain('Query JSON: {"kind":"merchantSpend","limit":100,"merchant":"Amazon","from":"2025-10-01","to":"2025-10-31"}');
    expect(capturedUserContent).toContain('Summary JSON:');
    expect(capturedUserContent).toContain('"perMerchant"');
    expect(capturedUserContent).toContain('Transactions JSON: ');
    expect(capturedUserContent).toContain('"merchant":"CVS"');
  });

  it('ensures large transaction payload remains internally consistent', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    const { transactions, summary } = buildLargeTransactionFixture();
    let expectedReply = '';
    const fetchMock = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const msgs = body?.messages ?? [];
      const userMsg = msgs.find((m: any) => m.role === 'user');
      const content = userMsg?.content || '';
      const summaryMatch = content.match(/Summary JSON:\s*(.+)\n/);
      const transactionsMatch = content.match(/Transactions JSON:\s*(.+)$/s);
      expect(summaryMatch).toBeTruthy();
      expect(transactionsMatch).toBeTruthy();
      const parsedSummary: TransactionsSummary = JSON.parse(summaryMatch![1].trim());
      const parsedTransactions: TransactionSummary[] = JSON.parse(
        transactionsMatch![1].trim()
      );
      const recomputedSummary = computeSummaryForFixture(parsedTransactions, {
        from: parsedSummary.from,
        to: parsedSummary.to,
      });
      expect(parsedSummary).toEqual(recomputedSummary);

      expectedReply = `you spent $${parsedSummary.totalSpend.toFixed(2)} from ${parsedSummary.from} to ${parsedSummary.to} with $${parsedSummary.pendingSpend.toFixed(2)} pending and $${parsedSummary.totalRefund.toFixed(2)} refunded`;

      return new Response(
        JSON.stringify({ choices: [{ message: { content: expectedReply } }] }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    });
    // @ts-expect-error test mutates global fetch
    global.fetch = fetchMock;

    const { generateReply } = await import('../lib/llm');
    const reply = await generateReply('transactions' as any, {
      transactions,
      moreAvailable: false,
      history: 'user: how much did i spend?',
      userText: 'how much did i spend this month?',
      profile: { name: 'Test User' },
      summaryJson: JSON.stringify(summary),
      transactionsJson: JSON.stringify(transactions),
      query: {
        kind: 'merchantSpend',
        limit: 100,
        merchant: null,
        from: summary.from,
        to: summary.to,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reply).toBe(expectedReply);
  });
});


