import { describe, it, expect, beforeEach, vi } from 'vitest';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  message: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
};

const chooseIntentMock = vi.fn();
const getTransactionsMock = vi.fn();
const generateReplyMock = vi.fn();
const sendMessageMock = vi.fn();

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/transactionQuery', () => {
  const parse = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('today')) {
      return {
        query: {
          kind: 'recent',
          from: '2025-11-10',
          to: '2025-11-10',
          limit: 50,
        },
        overrideRange: true,
      };
    }
    if (lower.includes('amazon')) {
      return {
        query: {
          kind: 'merchantSpend',
          merchant: 'amazon',
          from: '2025-11-08',
          to: '2025-11-09',
          limit: 100,
        },
        overrideRange: false,
      };
    }
    if (lower.includes('general merchandise')) {
      return {
        query: {
          kind: 'recent',
          from: '2025-11-08',
          to: '2025-11-09',
          limit: 500,
        },
        overrideRange: false,
      };
    }
    if (lower.includes('food')) {
      return {
        query: {
          kind: 'merchantSpend',
          merchant: 'food',
          from: '2025-11-08',
          to: '2025-11-09',
          limit: 100,
        },
        overrideRange: false,
      };
    }
    return {
      query: {
        kind: 'recent',
        from: '2025-11-08',
        to: '2025-11-09',
        limit: 50,
      },
      overrideRange: false,
    };
  };
  return {
    RECENT_FALLBACK_LIMIT: 50,
    parseTransactionsQuery: (text: string) => parse(text).query,
    parseTransactionsQueryWithOverrides: parse,
  };
});
vi.mock('@/lib/llm', () => ({
  chooseIntentFromText: chooseIntentMock,
  generateReply: generateReplyMock,
}));
const isExcludedFromSummaryMock = vi.fn((txn?: { category?: string | null }) => {
  const category = txn?.category?.toString().toLowerCase() ?? '';
  return category.includes('transfer');
});
const buildTransactionsSummaryMock = vi.fn((transactions: any[], params: { from: string; to: string }) => {
  const merchantMap = new Map<string, any>();
  const categoryMap = new Map<string, any>();
  let totalSpend = 0;
  let totalRefund = 0;
  let pendingSpend = 0;
  let pendingRefund = 0;
  let pendingCount = 0;

  const getBucket = (map: Map<string, any>, key: string, label: string) => {
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
    return map.get(key)!;
  };

  for (const txn of transactions) {
    const amount = Number(txn.amount) || 0;
    const pending = Boolean(txn.pending);
    const categoryLabel = (txn.category ?? 'uncategorized').toString();
    const merchantLabel = txn.merchant ?? txn.description ?? 'unknown merchant';
    const categoryKey = categoryLabel.toLowerCase();
    const merchantKey = merchantLabel.toLowerCase();

    if (amount >= 0) {
      totalSpend += amount;
      if (pending) pendingSpend += amount;
    } else {
      const abs = Math.abs(amount);
      totalRefund += abs;
      if (pending) pendingRefund += abs;
    }
    if (pending) pendingCount += 1;

    const categoryBucket = getBucket(categoryMap, categoryKey, categoryLabel);
    const merchantBucket = getBucket(merchantMap, merchantKey, merchantLabel);
    for (const bucket of [categoryBucket, merchantBucket]) {
      bucket.amount += amount;
      if (amount >= 0) {
        bucket.spendAmount += amount;
        if (pending) bucket.pendingSpendAmount += amount;
      } else {
        const abs = Math.abs(amount);
        bucket.refundAmount += abs;
        if (pending) bucket.pendingRefundAmount += abs;
      }
      bucket.count += 1;
      if (pending) bucket.pendingCount += 1;
    }
  }

  return {
    from: params.from,
    to: params.to,
    totalAmount: totalSpend - totalRefund,
    totalSpend,
    totalRefund,
    pendingAmount: pendingSpend - pendingRefund,
    pendingSpend,
    pendingRefund,
    count: transactions.length,
    pendingCount,
    perMerchant: Array.from(merchantMap.values()),
    perCategory: Array.from(categoryMap.values()),
  };
});

vi.mock('@/lib/transactions', () => ({
  getTransactions: getTransactionsMock,
  isExcludedFromSummary: isExcludedFromSummaryMock,
  buildTransactionsSummary: buildTransactionsSummaryMock,
}));
vi.mock('@/lib/blooio', () => ({
  sendMessage: sendMessageMock,
  formatE164: (value: string) => value,
}));
vi.mock('@/lib/encryption', () => ({
  decryptMessage: vi.fn((value: string) => value),
  encryptMessage: vi.fn((value: string) => value),
}));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
vi.mock('@/lib/magic-link', () => ({ generateMagicLink: vi.fn() }));
vi.mock('@/lib/constants', () => ({
  RATE_LIMIT_WINDOW_MS: 60_000,
  MAX_MESSAGES_PER_WINDOW: 100,
}));
vi.mock('@/lib/balances', () => ({
  getBalances: vi.fn(),
  getBalancesBreakdown: vi.fn(),
}));
vi.mock('@/lib/transactionsContext', () => {
  const ONE_HOUR_MS = 1000 * 60 * 60;
  return {
    formatRangeLabel: (
      { from, to }: { from: string; to: string },
      options?: { prefix?: string }
    ) => (options?.prefix ? `${options.prefix} ${from} → ${to}` : `${from} → ${to}`),
    buildStoredTransactionsQuery: (query: any, now: Date = new Date(), meta: any = {}) => ({
      kind: query.kind,
      from: query.from,
      to: query.to,
      limit: query.limit,
      merchant: query.kind === 'merchantSpend' ? query.merchant ?? null : null,
      storedAt: now.toISOString(),
      source: meta.source ?? 'adhoc',
      label: meta.label ?? `${query.from} → ${query.to}`,
      tags: meta.tags ?? undefined,
      categoryFocusNormalized: meta.categoryFocus?.normalized ?? null,
      categoryFocusDisplay: meta.categoryFocus?.display ?? null,
    }),
    shouldReuseStoredQuery: (parsedResult: any, stored: any) => {
      if (!stored) return false;
      if (parsedResult.overrideRange) return false;
      const storedTime = Date.parse(stored.storedAt ?? '');
      if (!Number.isFinite(storedTime)) return false;
      return Date.now() - storedTime < ONE_HOUR_MS;
    },
    storedQueryToTransactionQuery: (stored: any) => {
      if (stored.kind === 'merchantSpend') {
        return {
          kind: 'merchantSpend',
          from: stored.from,
          to: stored.to,
          limit: stored.limit,
          merchant: stored.merchant,
        };
      }
      return {
        kind: 'recent',
        from: stored.from,
        to: stored.to,
        limit: stored.limit,
      };
    },
  };
});
vi.mock('@/lib/sms', () => ({
  splitIntoSmsSegments: (body: string) => [body],
}));

describe('handleLLMConversation stored query reuse', () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.message.findMany.mockReset();
    prismaMock.message.create.mockReset();
    chooseIntentMock.mockReset();
    getTransactionsMock.mockReset();
    generateReplyMock.mockReset();
    sendMessageMock.mockReset();
  });

  function mockUserWithStoredQuery(
    overrides?: Partial<StoredTransactionsQuery>,
    userOverrides?: Partial<{ lastWeeklyDigestAt: Date | null; lastTransactionsQuery: StoredTransactionsQuery | null }>
  ) {
    const stored: StoredTransactionsQuery = {
      kind: 'recent',
      from: '2025-11-03',
      to: '2025-11-09',
      limit: 500,
      merchant: null,
      storedAt: new Date().toISOString(),
      source: 'weekly_digest',
      label: 'weekly digest nov 3 → nov 9',
      tags: ['general merchandise', 'personal care', 'food and drink'],
      categoryFocusNormalized: null,
      categoryFocusDisplay: null,
      ...overrides,
    };
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      phone: '+13471234567',
      billingStatus: 'active',
      messagingStatus: 'active',
      isActive: true,
      lastTransactionsQuery: stored,
      lastWeeklyDigestAt: new Date(),
      ...userOverrides,
    });
    prismaMock.user.update.mockResolvedValue({});
  }

  function mockUserWithoutStoredQuery(userOverrides?: Partial<{ lastWeeklyDigestAt: Date | null }>) {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      phone: '+13471234567',
      billingStatus: 'active',
      messagingStatus: 'active',
      isActive: true,
      lastTransactionsQuery: null,
      lastWeeklyDigestAt: new Date(),
      ...userOverrides,
    });
    prismaMock.user.update.mockResolvedValue({});
  }

  function mockTransactionsReturn(overrides?: {
    transactions?: Array<Record<string, unknown>>;
    summary?: Record<string, unknown>;
    moreAvailable?: boolean;
  }) {
    getTransactionsMock.mockResolvedValue({
      transactions: overrides?.transactions ?? [],
      summary:
        overrides?.summary ?? {
          from: '2025-11-03',
          to: '2025-11-09',
          totalAmount: 0,
          totalSpend: 0,
          totalRefund: 0,
          pendingAmount: 0,
          pendingSpend: 0,
          pendingRefund: 0,
          count: 0,
          pendingCount: 0,
          perMerchant: [],
          perCategory: [],
        },
      moreAvailable: overrides?.moreAvailable ?? false,
    });
    generateReplyMock.mockResolvedValue('ok');
    sendMessageMock.mockResolvedValue(undefined);
    chooseIntentMock.mockResolvedValue('transactions');
    prismaMock.message.findMany.mockResolvedValue([]);
  }

  function buildTransaction(overrides: Record<string, unknown> = {}) {
    return {
      id: overrides.id ?? `txn-${Math.random().toString(36).slice(2, 8)}`,
      date: overrides.date ?? '2025-11-12',
      amount: overrides.amount ?? 100,
      currency: overrides.currency ?? 'USD',
      merchant: overrides.merchant ?? 'sample merchant',
      description: overrides.description ?? 'sample merchant',
      category: overrides.category ?? 'general merchandise',
      pending: overrides.pending ?? false,
      account: overrides.account ?? {
        id: 'acct-1',
        name: 'checking',
        institution: 'td bank',
        mask: '1234',
      },
    };
  }

  it('reuses stored query when parser falls back to recent', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn();
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'anything new?');

    expect(getTransactionsMock).toHaveBeenCalledTimes(1);
    expect(getTransactionsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      from: '2025-11-03',
      to: '2025-11-09',
      limit: 500,
      maxRows: 500,
    });
    expect(generateReplyMock).toHaveBeenCalledWith(
      'transactions',
      expect.objectContaining({
        rangeLabel: 'weekly digest nov 3 → nov 9',
        query: expect.objectContaining({
          from: '2025-11-03',
          to: '2025-11-09',
          limit: 500,
        }),
      }),
    );
  });

  it('reuses stored query when user references generic category keywords', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn();
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'where did i spend on food?');

    expect(getTransactionsMock).toHaveBeenCalledTimes(1);
    expect(getTransactionsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      from: '2025-11-03',
      to: '2025-11-09',
      limit: 100,
      maxRows: 100,
      merchant: 'food',
    });
  });

  it('stores override context when user specifies a new range', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn();
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'what did i spend today?');

    expect(getTransactionsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      from: '2025-11-10',
      to: '2025-11-10',
      limit: 50,
      maxRows: 50,
    });
    expect(prismaMock.user.update).toHaveBeenCalled();
  });

  it('forces weekly digest range for immediate category follow-up even when stored query reuse expires', async () => {
    const staleStoredAt = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    mockUserWithStoredQuery({ storedAt: staleStoredAt }, { lastWeeklyDigestAt: new Date() });
    mockTransactionsReturn({
      transactions: [
        buildTransaction({ category: 'food and drink', merchant: 'Cafe Rio', amount: 50 }),
      ],
    });
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        direction: 'outbound',
        sentAt: new Date(),
        content:
          'weekly summary: 2025-11-10 → 2025-11-16 total spend $520.\ncategory breakdown:\n🧴 personal care $94\n🛍️ general merchandise $319\npending to watch: $85 still clearing.',
      },
    ]);
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'break down the food and drink');

    expect(getTransactionsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      from: '2025-11-03',
      to: '2025-11-09',
      limit: 100,
      maxRows: 100,
      merchant: 'food',
      category: 'food and drink',
    });
    expect(generateReplyMock).toHaveBeenCalledWith(
      'transactions',
      expect.objectContaining({
        rangeLabel: 'weekly digest nov 3 → nov 9',
      }),
    );
  });

  it('forces weekly digest range when user references a category label without keywords', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn({
      transactions: [
        buildTransaction({ category: 'personal care', merchant: 'Target', amount: 70 }),
      ],
    });
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        direction: 'outbound',
        sentAt: new Date(),
        content:
          'weekly summary: 2025-11-10 → 2025-11-16 total spend $520.\ncategory breakdown:\n🧴 personal care $94\n🛍️ general merchandise $319\npending to watch: $85 still clearing.',
      },
    ]);
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'personal care total?');

    expect(getTransactionsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      from: '2025-11-03',
      to: '2025-11-09',
      limit: 500,
      maxRows: 500,
      category: 'personal care',
    });
    expect(generateReplyMock).toHaveBeenCalledWith(
      'transactions',
      expect.objectContaining({
        rangeLabel: 'weekly digest nov 3 → nov 9',
      }),
    );
  });

  it('passes category breakdown merchants to the LLM for digest follow-ups', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn({
      transactions: [
        buildTransaction({ merchant: 'Amazon', description: 'Amazon', amount: 239, category: 'general merchandise' }),
        buildTransaction({ merchant: 'Skool.com', description: 'Skool.com', amount: 120, category: 'general merchandise' }),
        buildTransaction({ merchant: 'Crunch Fitness', description: 'Crunch Fitness', amount: 85, category: 'general merchandise' }),
        buildTransaction({ merchant: 'Target', description: 'Target', amount: 70, category: 'personal care' }),
      ],
    });
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        direction: 'outbound',
        sentAt: new Date(),
        content:
          'weekly summary: 2025-11-10 → 2025-11-16 total spend $520.\ncategory breakdown:\n🧴 personal care $94\n🛍️ general merchandise $319\npending to watch: $85 still clearing.',
      },
    ]);
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'break down the general merchandise category please');

    expect(generateReplyMock).toHaveBeenCalledWith(
      'transactions',
      expect.objectContaining({
        categoryBreakdownJson: expect.stringContaining('Amazon'),
        categoryFocusLabel: 'general merchandise',
      }),
    );
  });

  it('returns a guardrail when category transactions are missing', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn({
      transactions: [
        buildTransaction({ merchant: 'Other Store', category: 'other', amount: 50 }),
      ],
    });
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        direction: 'outbound',
        sentAt: new Date(),
        content:
          'weekly summary: 2025-11-10 → 2025-11-16 total spend $520.\ncategory breakdown:\n🧴 personal care $94\n🛍️ general merchandise $319\npending to watch: $85 still clearing.',
      },
    ]);
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'break down the general merchandise category please');

    expect(generateReplyMock).not.toHaveBeenCalled();
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("can't see general merchandise"),
      }),
    );
  });

  it('keeps the last category focus sticky across follow-ups', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn({
      transactions: [
        buildTransaction({ category: 'general merchandise', merchant: 'Amazon', amount: 239 }),
      ],
    });
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'break down general merchandise please');

    const storedCall = prismaMock.user.update.mock.calls.at(-1);
    expect(storedCall).toBeTruthy();
    const storedQuery = storedCall?.[0]?.data?.lastTransactionsQuery;
    expect(storedQuery?.categoryFocusNormalized).toBe('general merchandise');

    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      phone: '+13471234567',
      billingStatus: 'active',
      messagingStatus: 'active',
      isActive: true,
      lastTransactionsQuery: storedQuery,
    });

    mockTransactionsReturn({
      transactions: [
        buildTransaction({ category: 'general merchandise', merchant: 'Skool.com', amount: 120 }),
      ],
    });

    await handleLLMConversation('+13471234567', 'what about pending spend?');

    expect(getTransactionsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        category: 'general merchandise',
      }),
    );
  });

  it('derives weekly digest range from lastWeeklyDigestAt when stored query is missing', async () => {
    const lastWeeklyDigestAt = new Date('2025-11-17T12:00:00Z');
    mockUserWithoutStoredQuery({ lastWeeklyDigestAt });
    mockTransactionsReturn({
      transactions: [
        buildTransaction({ category: 'food and drink', merchant: 'Cafe Rio', amount: 50 }),
      ],
    });
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        direction: 'outbound',
        sentAt: new Date(),
        content:
          'weekly summary: 2025-11-10 → 2025-11-16 total spend $520.\ncategory breakdown:\n🧴 personal care $94\n🛍️ general merchandise $319\npending to watch: $85 still clearing.',
      },
    ]);
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'break down the food and drink');

    expect(getTransactionsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      from: '2025-11-10',
      to: '2025-11-16',
      limit: 100,
      maxRows: 100,
      merchant: 'food',
    });
    expect(generateReplyMock).toHaveBeenCalledWith(
      'transactions',
      expect.objectContaining({
        rangeLabel: 'weekly digest 2025-11-10 → 2025-11-16',
      }),
    );
  });

  it('mirrors the weekly digest flow with mocked data', async () => {
    const digestTransactions = [
      buildTransaction({ merchant: 'Amazon', amount: 239.35, category: 'general merchandise' }),
      buildTransaction({ merchant: 'Skool.com', amount: 120, category: 'general merchandise' }),
      buildTransaction({ merchant: 'Crunch Fitness', amount: 80, category: 'general merchandise' }),
      buildTransaction({ merchant: 'Target', amount: 35.75, category: 'personal care' }),
      buildTransaction({ merchant: 'CVS', amount: 22.4, category: 'personal care' }),
      buildTransaction({ merchant: 'Starbucks', amount: 20, category: 'food and drink' }),
      buildTransaction({ merchant: 'Subway', amount: 15, category: 'food and drink' }),
    ];
    mockUserWithStoredQuery();
    mockTransactionsReturn({ transactions: digestTransactions });

    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'can you break down general merchandise?');

    const lastCall = generateReplyMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('transactions');
    expect(lastCall?.[1]).toEqual(
      expect.objectContaining({
        categoryBreakdownJson: expect.stringContaining('Amazon'),
        categoryFocusTotalsJson: expect.stringContaining('"spend":439.35'),
      })
    );
  });

  it('handles a category follow-up with pending transactions and refunds', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn({
      transactions: [
        buildTransaction({
          merchant: 'Trader Joes',
          amount: 45,
          category: 'food and drink',
          pending: false,
        }),
        buildTransaction({
          merchant: 'DoorDash',
          amount: 30,
          category: 'food and drink',
          pending: true,
        }),
        buildTransaction({
          merchant: 'Uber Eats',
          amount: -12,
          category: 'food and drink',
          pending: false,
        }),
      ],
    });
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'food and drink breakdown please');

    const lastCall = generateReplyMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('transactions');
    expect(lastCall?.[1]).toMatchObject({
      categoryFocusLabel: 'food and drink',
      categoryBreakdownJson: expect.stringContaining('Trader Joes'),
      categoryFocusTotalsJson: expect.stringContaining('"pendingSpend":30'),
    });
  });

  it('falls back gracefully when no matching transactions after digest', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn({ transactions: [] });
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'tell me about transfer out');

    expect(generateReplyMock).toHaveBeenCalled();
    expect(sendMessageMock).toHaveBeenCalled();
  });

  it('handles zero-spend weeks gracefully', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn({
      transactions: [],
      summary: {
        from: '2025-11-03',
        to: '2025-11-09',
        totalAmount: 0,
        totalSpend: 0,
        totalRefund: 0,
        pendingAmount: 0,
        pendingSpend: 0,
        pendingRefund: 0,
        count: 0,
        pendingCount: 0,
        perMerchant: [],
        perCategory: [],
      },
    });
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'whats my spend this week?');

    expect(generateReplyMock).toHaveBeenCalledWith(
      'transactions',
      expect.objectContaining({
        transactionsJson: '[]',
        summaryJson: expect.stringContaining('"totalSpend":0'),
      })
    );
  });

  it('handles pending-heavy categories correctly', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn({
      transactions: [
        buildTransaction({ merchant: 'Pending Store', amount: 100, pending: true, category: 'general merchandise' }),
      ],
    });
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        direction: 'outbound',
        sentAt: new Date(),
        content:
          'weekly summary: 2025-11-10 → 2025-11-16 total spend $100.\ncategory breakdown:\n🛍️ general merchandise $100\npending to watch: $100 still clearing.',
      },
    ]);
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'break down general merchandise');

    expect(generateReplyMock).toHaveBeenCalledWith(
      'transactions',
      expect.objectContaining({
        categoryBreakdownJson: expect.stringContaining('Pending Store'),
        categoryFocusTotalsJson: expect.stringContaining('"pendingSpend":100'),
      })
    );
  });

  it('does not reuse digest range once the sticky window expires', async () => {
    const staleDigest = new Date(Date.now() - 1000 * 60 * 60 * 120);
    mockUserWithStoredQuery({ storedAt: staleDigest.toISOString() }, { lastWeeklyDigestAt: staleDigest });
    mockTransactionsReturn();
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        direction: 'outbound',
        sentAt: staleDigest,
        content:
          'weekly summary: 2025-11-03 → 2025-11-09 total spend $520.\ncategory breakdown:\n🧴 personal care $94\n🛍️ general merchandise $319\npending to watch: $85 still clearing.',
      },
    ]);
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'personal care total?');

    expect(generateReplyMock).toHaveBeenCalledWith(
      'transactions',
      expect.objectContaining({
        rangeLabel: '2025-11-08 → 2025-11-09',
      }),
    );
  });

  it('uses the latest weekly digest range when multiple digests exist', async () => {
    mockUserWithStoredQuery(
      {
        from: '2025-11-10',
        to: '2025-11-16',
        label: 'weekly digest nov 10 → nov 16',
        tags: ['general merchandise'],
      },
      { lastWeeklyDigestAt: new Date('2025-11-17T12:00:00Z') },
    );
    mockTransactionsReturn({
      transactions: [
        buildTransaction({ merchant: 'Amazon', amount: 200, category: 'general merchandise' }),
      ],
    });
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        direction: 'outbound',
        sentAt: new Date('2025-11-17T12:00:00Z'),
        content:
          'weekly summary: 2025-11-10 → 2025-11-16 total spend $520.\ncategory breakdown:\n🛍️ general merchandise $319\npending to watch: $85 still clearing.',
      },
    ]);
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'general merchandise breakdown');

    expect(getTransactionsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      from: '2025-11-10',
      to: '2025-11-16',
      limit: 500,
      maxRows: 500,
      category: 'general merchandise',
    });
    expect(generateReplyMock).toHaveBeenCalledWith(
      'transactions',
      expect.objectContaining({
        rangeLabel: 'weekly digest nov 10 → nov 16',
      }),
    );
  });

  it('honors explicit today overrides even after a digest', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn();
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'show me todays spending');

    expect(getTransactionsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      from: '2025-11-10',
      to: '2025-11-10',
      limit: 50,
      maxRows: 50,
    });
    expect(generateReplyMock).toHaveBeenCalledWith(
      'transactions',
      expect.objectContaining({
        rangeLabel: '2025-11-10 → 2025-11-10',
      }),
    );
  });

  it('distinguishes merchant vs category follow-ups', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn();
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'show amazon spend');

    expect(getTransactionsMock).toHaveBeenLastCalledWith({
      userId: 'user-1',
      from: '2025-11-03',
      to: '2025-11-09',
      limit: 100,
      maxRows: 100,
      merchant: 'amazon',
    });

    getTransactionsMock.mockClear();
    generateReplyMock.mockClear();
    mockTransactionsReturn();
    mockUserWithStoredQuery();
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        direction: 'outbound',
        sentAt: new Date(),
        content:
          'weekly summary: 2025-11-10 → 2025-11-16 total spend $520.\ncategory breakdown:\n🛍️ general merchandise $319\npending to watch: $85 still clearing.',
      },
    ]);
    await handleLLMConversation('+13471234567', 'break down general merchandise');

    expect(getTransactionsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      from: '2025-11-03',
      to: '2025-11-09',
      limit: 500,
      maxRows: 500,
      category: 'general merchandise',
    });
  });

  it('filters transfer categories out of breakdowns', async () => {
    mockUserWithStoredQuery();
    mockTransactionsReturn({
      transactions: [
        buildTransaction({ merchant: 'Amazon', amount: 239, category: 'general merchandise' }),
        buildTransaction({ merchant: 'Robinhood', amount: 1000, category: 'transfer out' }),
      ],
    });
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        direction: 'outbound',
        sentAt: new Date(),
        content:
          'weekly summary: 2025-11-10 → 2025-11-16 total spend $520.\ncategory breakdown:\n🛍️ general merchandise $319\npending to watch: $85 still clearing.',
      },
    ]);
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'break down general merchandise');

    expect(generateReplyMock).toHaveBeenCalledWith(
      'transactions',
      expect.objectContaining({
        categoryBreakdownJson: expect.stringContaining('Amazon'),
      }),
    );
    expect(
      (generateReplyMock.mock.calls.at(-1)?.[1]?.categoryBreakdownJson as string) ?? '',
    ).not.toContain('Robinhood');
  });

  it('uses stored digest snapshots for category breakdowns to keep totals aligned', async () => {
    const snapshot = [
      buildTransaction({ merchant: 'Styles Barber Lounge', amount: 30, category: 'personal care' }),
      buildTransaction({ merchant: 'Sephora', amount: 64, category: 'personal care' }),
      buildTransaction({ merchant: 'Amazon', amount: 239, category: 'general merchandise' }),
    ];
    mockUserWithStoredQuery(
      { storedTransactions: snapshot },
      { lastWeeklyDigestAt: new Date() },
    );
    mockTransactionsReturn();
    getTransactionsMock.mockClear();
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        direction: 'outbound',
        sentAt: new Date(),
        content:
          'weekly summary: 2025-11-10 → 2025-11-16 total spend $520.\ncategory breakdown:\n🧴 personal care $94\n🛍️ general merchandise $319\npending to watch: $85 still clearing.',
      },
    ]);
    const { handleLLMConversation } = await import('../lib/conversation');
    await handleLLMConversation('+13471234567', 'personal care expenses?');

    expect(getTransactionsMock).not.toHaveBeenCalled();
    expect(generateReplyMock).not.toHaveBeenCalled();
    const sms = sendMessageMock.mock.calls.at(-1)?.[0]?.body ?? '';
    expect(sms).toContain('Styles Barber Lounge');
    expect(sms).toContain('Sephora');
    expect(sms).toContain('$94');
  });
});

type StoredTransactionsQuery = {
  kind: 'recent' | 'merchantSpend';
  from: string;
  to: string;
  limit: number;
  merchant: string | null;
  storedAt: string;
  source: string;
  label: string;
  tags?: string[];
  categoryFocusNormalized?: string | null;
  categoryFocusDisplay?: string | null;
  storedTransactions?: Array<Record<string, unknown>>;
};

