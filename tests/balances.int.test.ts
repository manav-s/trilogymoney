import { describe, it, expect, vi, beforeEach } from 'vitest';

type InMemItem = { id: string; userId: string; accessToken: string; institutionName?: string | null; lastSync?: Date | null };
type InMemAccount = {
  id: string;
  itemId: string;
  accountId: string;
  name: string;
  officialName?: string | null;
  mask?: string | null;
  type?: string | null;
  subtype?: string | null;
  currency?: string | null;
  currentBalance?: number | null;
  availableBalance?: number | null;
  updatedAt?: Date | null;
  isActive?: boolean;
};

let prismaMockGlobal: any;

vi.mock('../lib/db/db', () => ({ prisma: prismaMockGlobal }));
vi.mock('../lib/integrations/plaid', () => ({
  getPlaidClient: () => ({
    accountsBalanceGet: vi.fn(async ({ access_token }: any) => {
      const r = (globalThis as any).__TEST_PLAID_RESOLVER__ as (t: string) => any;
      const data = r(access_token);
      if (data instanceof Error) throw data;
      return { data } as any;
    }),
  }),
}));
vi.mock('../lib/db/encryption', () => ({
  decryptMessage: (s: string) => s,
}));

describe('lib/balances getBalances integration (mocked Plaid + Prisma)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  function setupInMemoryPrisma() {
    const items: InMemItem[] = [];
    const accounts: InMemAccount[] = [];

    const prismaMock = {
      plaidItem: {
        findMany: vi.fn(async (args: any) => {
          const where = args?.where ?? {};
          const byUser = items.filter((i) => !where?.userId || i.userId === where.userId);
          return byUser.map((i) => ({ id: i.id, accessToken: i.accessToken, institutionName: i.institutionName ?? null }));
        }),
        update: vi.fn(async (args: any) => {
          const id = args?.where?.id;
          const data = args?.data ?? {};
          const it = items.find((i) => i.id === id);
          if (it) {
            it.lastSync = data.lastSync ?? it.lastSync ?? new Date();
          }
          return it || null;
        }),
      },
      plaidAccount: {
        upsert: vi.fn(async (args: any) => {
          const whereId = args?.where?.accountId as string;
          const existing = accounts.find((a) => a.accountId === whereId);
          const select = args?.select;
          if (existing) {
            const upd = args?.update ?? {};
            Object.assign(existing, {
              name: upd.name ?? existing.name,
              officialName: upd.officialName ?? existing.officialName,
              mask: upd.mask ?? existing.mask,
              type: upd.type ?? existing.type,
              subtype: upd.subtype ?? existing.subtype,
              currency: upd.currency ?? existing.currency,
              currentBalance: upd.currentBalance ?? existing.currentBalance,
              availableBalance: upd.availableBalance ?? existing.availableBalance,
              updatedAt: new Date(),
            });
            return project(existing, select);
          }
          const create = args?.create ?? {};
          const row: InMemAccount = {
            id: `acc_${Math.random().toString(36).slice(2, 8)}`,
            itemId: create.itemId,
            accountId: create.accountId,
            name: create.name ?? 'Account',
            officialName: create.officialName ?? null,
            mask: create.mask ?? null,
            type: create.type ?? 'unknown',
            subtype: create.subtype ?? null,
            currency: create.currency ?? null,
            currentBalance: create.currentBalance ?? null,
            availableBalance: create.availableBalance ?? null,
            updatedAt: new Date(),
            isActive: true,
          };
          accounts.push(row);
          return project(row, select);
        }),
        findMany: vi.fn(async (args: any) => {
          const where = args?.where ?? {};
          const itemIdIn: string[] = where?.itemId?.in ?? [];
          const active = accounts.filter((a) => (itemIdIn.length ? itemIdIn.includes(a.itemId) : true) && (where?.isActive ? a.isActive !== false : true));
          const select = args?.select;
          return active.map((a) => project(a, select));
        }),
      },
    } as any;

    function project<T extends Record<string, any>>(obj: T, select?: Record<string, boolean>) {
      if (!select) return { ...obj };
      const out: Record<string, any> = {};
      for (const k of Object.keys(select)) {
        if (select[k]) out[k] = (obj as any)[k];
      }
      return out;
    }

    prismaMockGlobal = prismaMock;
    return { prismaMock, state: { items, accounts } };
  }

  function setPlaidResolver(resolver: (accessToken: string) => any) {
    (globalThis as any).__TEST_PLAID_RESOLVER__ = resolver;
  }

  it('returns normalized accounts and total (available prefers current)', async () => {
    const { prismaMock, state } = setupInMemoryPrisma();
    // prismaMockGlobal already set in setupInMemoryPrisma

    // Two items for same user
    state.items.push(
      { id: 'it1', userId: 'u1', accessToken: 'tok1', institutionName: 'Bank A' },
      { id: 'it2', userId: 'u1', accessToken: 'tok2', institutionName: 'Bank B' },
    );

    setPlaidResolver((token) => {
      if (token === 'tok1') {
        return {
          accounts: [
            { account_id: 'a1', name: 'Chk A', official_name: 'Checking A', mask: '1111', type: 'depository', subtype: 'checking', balances: { iso_currency_code: 'USD', current: 1200.25, available: 1000.00 } },
            { account_id: 'a2', name: 'Sav A', mask: '2222', type: 'depository', subtype: 'savings', balances: { iso_currency_code: 'USD', current: 500.00, available: null } },
          ]
        };
      }
      if (token === 'tok2') {
        return {
          accounts: [
            { account_id: 'a3', name: 'Card B', mask: '3333', type: 'credit', subtype: 'credit card', balances: { iso_currency_code: 'USD', current: -200.50, available: null } },
          ]
        };
      }
      return { accounts: [] };
    });

    const { getBalances } = await import('../lib/services/balances');
    const res = await getBalances({ userId: 'u1' });

    expect(res.count).toBe(2);
    // cash total counts only depository accounts: available(1000.00) + current(500.00) = 1500.00
    expect(Math.round(res.total * 100)).toBe(150000);
    expect(res.accounts.find(a => a.accountId === 'a1')?.institution).toBe('Bank A');
    expect(res.accounts.find(a => a.accountId === 'a2')?.institution).toBe('Bank A');
    expect(res.accounts.find(a => a.accountId === 'a3')).toBeUndefined();
  });

  // Additional edge-case tests (partial errors, inactive filters) can be added later.
});


