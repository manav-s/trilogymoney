import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
  },
  plaidItem: {
    findMany: vi.fn(),
  },
  plaidAccount: {
    findMany: vi.fn(),
  },
};

const decryptMock = vi.fn();
const logErrorMock = vi.fn();
const plaidClientMock = {
  transactionsGet: vi.fn(),
};

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/encryption', () => ({ decryptMessage: decryptMock }));
vi.mock('@/lib/logger', () => ({ logError: logErrorMock }));
vi.mock('@/lib/plaid', () => ({ getPlaidClient: () => plaidClientMock }));

describe('lib/transactions getTransactions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    prismaMock.user.findUnique.mockReset();
    prismaMock.plaidItem.findMany.mockReset();
    prismaMock.plaidAccount.findMany.mockReset();
    decryptMock.mockReset();
    logErrorMock.mockReset();
    plaidClientMock.transactionsGet.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns normalized transactions for paid users', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', billingStatus: 'active' });
    prismaMock.plaidItem.findMany.mockResolvedValue([
      { id: 'item-1', accessToken: 'enc-token-1', institutionName: 'Bank' },
    ]);
    prismaMock.plaidAccount.findMany.mockResolvedValue([{ accountId: 'acc-1' }]);
    decryptMock.mockReturnValue('access-1');
    plaidClientMock.transactionsGet.mockResolvedValue({
      data: {
        accounts: [
          {
            account_id: 'acc-1',
            name: 'Checking',
            mask: '1234',
          },
        ],
        transactions: [
          {
            transaction_id: 'tx-1',
            account_id: 'acc-1',
            amount: 42.13,
            iso_currency_code: 'USD',
            merchant_name: 'CVS',
            name: 'CVS Pharmacy',
            date: '2025-11-05',
            pending: false,
            personal_finance_category: { primary: 'HEALTHCARE', detailed: 'PHARMACY' },
          },
        ],
        total_transactions: 1,
      },
    });

    const { getTransactions } = await import('../lib/transactions');
    const result = await getTransactions({ userId: 'user-1', limit: 3 });

    expect(result.moreAvailable).toBe(false);
    expect(result.transactions).toHaveLength(1);
    expect(result.summary).toMatchObject({
      count: 1,
      totalAmount: 42.13,
      pendingAmount: 0,
      perMerchant: expect.any(Array),
      perCategory: expect.any(Array),
    });
    const first = result.transactions[0];
    expect(first.id).toBe('tx-1');
    expect(first.amount).toBe(42.13);
    expect(first.account).toEqual({
      id: 'acc-1',
      name: 'Checking',
      institution: 'Bank',
      mask: '1234',
    });
    expect(first.category).toBe('HEALTHCARE');
  });

  it('filters by merchant substring and respects limit', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', billingStatus: 'active' });
    prismaMock.plaidItem.findMany.mockResolvedValue([
      { id: 'item-1', accessToken: 'enc-token-1', institutionName: null },
    ]);
    prismaMock.plaidAccount.findMany.mockResolvedValue([{ accountId: 'acc-1' }]);
    decryptMock.mockReturnValue('access-1');
    plaidClientMock.transactionsGet.mockResolvedValue({
      data: {
        accounts: [{ account_id: 'acc-1', name: 'Checking', mask: null }],
        transactions: [
          {
            transaction_id: 'tx-1',
            account_id: 'acc-1',
            amount: 10,
            iso_currency_code: 'USD',
            merchant_name: 'Starbucks',
            name: 'STARBUCKS 1234',
            date: '2025-11-05',
            pending: false,
            personal_finance_category: { primary: 'FOOD_AND_DRINK' },
          },
          {
            transaction_id: 'tx-2',
            account_id: 'acc-1',
            amount: 5,
            iso_currency_code: 'USD',
            merchant_name: 'Target',
            name: 'TARGET',
            date: '2025-11-04',
            pending: false,
            personal_finance_category: { primary: 'SHOPPING' },
          },
        ],
        total_transactions: 2,
      },
    });

    const { getTransactions } = await import('../lib/transactions');
    const result = await getTransactions({ userId: 'user-1', limit: 5, merchant: 'star' });

    expect(result.transactions).toHaveLength(1);
    expect(result.summary).toMatchObject({
      count: 1,
      perMerchant: expect.arrayContaining([
        expect.objectContaining({ label: 'Starbucks', count: 1 }),
      ]),
    });
    expect(result.transactions[0].merchant).toBe('Starbucks');
    expect(result.moreAvailable).toBe(false);
  });

  it('marks moreAvailable when total exceeds fetched transactions', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', billingStatus: 'active' });
    prismaMock.plaidItem.findMany.mockResolvedValue([
      { id: 'item-1', accessToken: 'enc-token-1', institutionName: null },
    ]);
    prismaMock.plaidAccount.findMany.mockResolvedValue([{ accountId: 'acc-1' }]);
    decryptMock.mockReturnValue('access-1');
    plaidClientMock.transactionsGet.mockResolvedValue({
      data: {
        accounts: [{ account_id: 'acc-1', name: 'Checking', mask: null }],
        transactions: [
          {
            transaction_id: 'tx-1',
            account_id: 'acc-1',
            amount: 10,
            iso_currency_code: 'USD',
            merchant_name: 'Store',
            name: 'Store',
            date: '2025-11-05',
            pending: false,
          },
        ],
        total_transactions: 5,
      },
    });

    const { getTransactions } = await import('../lib/transactions');
    const result = await getTransactions({ userId: 'user-1', limit: 1 });

    expect(result.transactions).toHaveLength(1);
    expect(result.summary.count).toBe(1);
    expect(result.moreAvailable).toBe(true);
  });

  it('throws for unpaid users', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', billingStatus: 'inactive' });

    const { getTransactions } = await import('../lib/transactions');
    await expect(getTransactions({ userId: 'user-1' })).rejects.toThrow(/paid users/);
  });

  it('returns empty list when Plaid fails after retries', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', billingStatus: 'active' });
    prismaMock.plaidItem.findMany.mockResolvedValue([
      { id: 'item-1', accessToken: 'enc-token-1', institutionName: null },
    ]);
    prismaMock.plaidAccount.findMany.mockResolvedValue([{ accountId: 'acc-1' }]);
    decryptMock.mockReturnValue('access-1');
    plaidClientMock.transactionsGet.mockRejectedValueOnce({ response: { status: 500 } });
    plaidClientMock.transactionsGet.mockRejectedValueOnce({ response: { status: 500 } });
    plaidClientMock.transactionsGet.mockRejectedValueOnce({ response: { status: 500 } });

    const { getTransactions } = await import('../lib/transactions');
    const result = await getTransactions({ userId: 'user-1' });

    expect(result.transactions).toHaveLength(0);
    expect(result.summary).toMatchObject({
      count: 0,
      totalAmount: 0,
      pendingAmount: 0,
    });
    expect(result.moreAvailable).toBe(false);
    expect(logErrorMock).toHaveBeenCalled();
  });
});


