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
vi.mock('@/lib/transactions', () => ({
  getTransactions: getTransactionsMock,
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
    formatRangeLabel: ({ from, to }: { from: string; to: string }) => `${from} → ${to}`,
    buildStoredTransactionsQuery: (query: any, now: Date = new Date(), meta: any = {}) => ({
      kind: query.kind,
      from: query.from,
      to: query.to,
      limit: query.limit,
      merchant: query.kind === 'merchantSpend' ? query.merchant ?? null : null,
      storedAt: now.toISOString(),
      source: meta.source ?? 'adhoc',
      label: meta.label ?? `${query.from} → ${query.to}`,
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
    userOverrides?: Partial<{ lastWeeklyDigestAt: Date | null }>
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

  function mockTransactionsReturn() {
    getTransactionsMock.mockResolvedValue({
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
      moreAvailable: false,
    });
    generateReplyMock.mockResolvedValue('ok');
    sendMessageMock.mockResolvedValue(undefined);
    chooseIntentMock.mockResolvedValue('transactions');
    prismaMock.message.findMany.mockResolvedValue([]);
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
    mockTransactionsReturn();
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        direction: 'outbound',
        sentAt: new Date(),
        content: 'weekly summary: 2025-11-10 → 2025-11-16 total spend $520.',
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
    });
    expect(generateReplyMock).toHaveBeenCalledWith(
      'transactions',
      expect.objectContaining({
        rangeLabel: 'weekly digest nov 3 → nov 9',
      }),
    );
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
};

