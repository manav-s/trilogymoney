import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  plaidAccount: {
    count: vi.fn(),
  },
};

const sendMessageMock = vi.fn();
const getTransactionsMock = vi.fn();
const buildTransactionsSummaryMock = vi.fn();
const isExcludedFromSummaryMock = vi.fn();
const getBalancesBreakdownMock = vi.fn();
const generateWeeklyDigestMessageMock = vi.fn();
const buildWeeklyDigestContextMock = vi.fn();
const extractHighlightsMock = vi.fn();

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/blooio', () => ({ sendMessage: sendMessageMock }));
vi.mock('@/lib/transactions', () => ({
  getTransactions: getTransactionsMock,
  buildTransactionsSummary: buildTransactionsSummaryMock,
  isExcludedFromSummary: isExcludedFromSummaryMock,
}));
vi.mock('@/lib/balances', () => ({
  getBalancesBreakdown: getBalancesBreakdownMock,
}));
vi.mock('@/lib/llm', () => ({
  generateWeeklyDigestMessage: generateWeeklyDigestMessageMock,
}));
vi.mock('@/lib/weeklyDigest', () => ({
  buildWeeklyDigestContext: buildWeeklyDigestContextMock,
  extractHighlights: extractHighlightsMock,
}));

describe('postOnboardingWelcome', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-20T12:00:00Z'));
    vi.clearAllMocks();
    buildWeeklyDigestContextMock.mockReturnValue({
      spendSummary: {
        topCategories: [{ label: 'shopping', spendAmount: 100, refundAmount: 0, count: 1 }],
      },
    });
    extractHighlightsMock.mockReturnValue(['shopping']);
    buildTransactionsSummaryMock.mockReturnValue({
      from: '2025-11-13',
      to: '2025-11-20',
      totalSpend: 100,
      totalRefund: 0,
      pendingSpend: 0,
      pendingRefund: 0,
      count: 1,
      pendingCount: 0,
      perMerchant: [],
      perCategory: [],
    });
    isExcludedFromSummaryMock.mockReturnValue(false);
    getBalancesBreakdownMock.mockResolvedValue({
      cash: { total: 1000, count: 1, accounts: [] },
      credit: { owedTotal: 0, count: 0, accounts: [] },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends welcome and digest when user has recent spend', async () => {
    // updateMany succeeds (atomic check-and-set)
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 1 });
    
    // findUnique after winning the race
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      phone: '+15551234567',
      timezone: 'America/New_York',
    });

    prismaMock.plaidAccount.count.mockResolvedValue(1);

    getTransactionsMock.mockResolvedValue({
      transactions: [
        {
          id: 'txn-1',
          amount: 42,
          category: 'shopping',
          pending: false,
          merchant: 'Amazon',
          date: '2025-11-19',
        },
      ],
    });

    generateWeeklyDigestMessageMock.mockResolvedValue('here is your first digest!');
    prismaMock.user.update.mockResolvedValue({});

    const { postOnboardingWelcome } = await import('../lib/onboarding-welcome');
    await postOnboardingWelcome('user-1');

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: '+15551234567',
        body: expect.stringContaining('welcome to trilogy'),
      }),
    );
    expect(sendMessageMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: '+15551234567',
        body: 'here is your first digest!',
      }),
    );

    // updateMany sets welcomeSentAt atomically, update persists digest snapshot
    expect(prismaMock.user.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
  });

  it('skips when user was welcomed recently', async () => {
    // updateMany returns 0 (welcomeSentAt already set, or user not eligible)
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 0 });

    const { postOnboardingWelcome } = await import('../lib/onboarding-welcome');
    await postOnboardingWelcome('user-1');

    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(prismaMock.plaidAccount.count).not.toHaveBeenCalled();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('falls back to link reminder when no accounts', async () => {
    // updateMany succeeds (atomic check-and-set)
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 1 });
    
    // findUnique after winning the race
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      phone: '+15551234567',
      timezone: 'America/New_York',
    });

    prismaMock.plaidAccount.count.mockResolvedValue(0);

    const { postOnboardingWelcome } = await import('../lib/onboarding-welcome');
    await postOnboardingWelcome('user-1');

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        body: expect.stringContaining("i'll keep watching for new accounts"),
      }),
    );
    expect(getTransactionsMock).not.toHaveBeenCalled();
    expect(prismaMock.user.updateMany).toHaveBeenCalledTimes(1);
  });

  it('still sends digest when snapshot persistence fails', async () => {
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      phone: '+15551234567',
      timezone: 'America/New_York',
    });
    prismaMock.plaidAccount.count.mockResolvedValue(1);
    getTransactionsMock.mockResolvedValue({
      transactions: [
        {
          id: 'txn-1',
          amount: 42,
          category: 'shopping',
          pending: false,
          merchant: 'Amazon',
          date: '2025-11-19',
        },
      ],
    });
    generateWeeklyDigestMessageMock.mockResolvedValue('here is your first digest!');
    prismaMock.user.update
      .mockRejectedValueOnce(new Error('persist fail'))
      .mockResolvedValueOnce({});

    const { postOnboardingWelcome } = await import('../lib/onboarding-welcome');
    await postOnboardingWelcome('user-1');

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ body: 'here is your first digest!' }),
    );
    expect(prismaMock.user.update).toHaveBeenCalledTimes(2);
  });

  it('sends fallback digest when llm output is null', async () => {
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      phone: '+15551234567',
      timezone: 'America/New_York',
    });
    prismaMock.plaidAccount.count.mockResolvedValue(1);
    getTransactionsMock.mockResolvedValue({
      transactions: [
        {
          id: 'txn-1',
          amount: 42,
          category: 'shopping',
          pending: false,
          merchant: 'Amazon',
          date: '2025-11-19',
        },
      ],
    });
    generateWeeklyDigestMessageMock.mockResolvedValue(null);
    prismaMock.user.update.mockResolvedValue({});

    const { postOnboardingWelcome } = await import('../lib/onboarding-welcome');
    await postOnboardingWelcome('user-1');

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        body: expect.stringContaining('weekly summary:'),
      }),
    );
  });

  it('delivers a digest even when there are zero transactions', async () => {
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      phone: '+15551234567',
      timezone: 'America/New_York',
    });
    prismaMock.plaidAccount.count.mockResolvedValue(1);
    getTransactionsMock.mockResolvedValue({
      transactions: [],
    });
    buildTransactionsSummaryMock.mockReturnValueOnce({
      from: '2025-11-13',
      to: '2025-11-20',
      totalSpend: 0,
      totalRefund: 0,
      pendingSpend: 0,
      pendingRefund: 0,
      count: 0,
      pendingCount: 0,
      perMerchant: [],
      perCategory: [],
    });
    prismaMock.user.update.mockResolvedValue({});

    const { postOnboardingWelcome } = await import('../lib/onboarding-welcome');
    await postOnboardingWelcome('user-1');

    expect(generateWeeklyDigestMessageMock).not.toHaveBeenCalled();
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        body: expect.stringContaining('weekly summary:'),
      }),
    );
  });
});

