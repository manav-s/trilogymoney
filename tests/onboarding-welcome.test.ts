import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
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
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      phone: '+15551234567',
      timezone: 'America/New_York',
      messagingStatus: 'active',
      billingStatus: 'active',
      isActive: true,
      welcomeSentAt: null,
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

    // First update persists digest snapshot, second stamps welcomeSentAt
    expect(prismaMock.user.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.user.update.mock.calls[1]?.[0]?.data).toHaveProperty('welcomeSentAt');
  });

  it('skips when user was welcomed recently', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      phone: '+15551234567',
      timezone: 'America/New_York',
      messagingStatus: 'active',
      billingStatus: 'active',
      isActive: true,
      welcomeSentAt: new Date(Date.now() - 1000 * 60 * 30),
    });

    const { postOnboardingWelcome } = await import('../lib/onboarding-welcome');
    await postOnboardingWelcome('user-1');

    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(prismaMock.plaidAccount.count).not.toHaveBeenCalled();
  });

  it('falls back to link reminder when no accounts', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      phone: '+15551234567',
      timezone: 'America/New_York',
      messagingStatus: 'active',
      billingStatus: 'active',
      isActive: true,
      welcomeSentAt: null,
    });

    prismaMock.plaidAccount.count.mockResolvedValue(0);
    prismaMock.user.update.mockResolvedValue({});

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
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.update.mock.calls[0]?.[0]?.data).toHaveProperty('welcomeSentAt');
  });
});

