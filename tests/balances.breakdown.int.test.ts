import { describe, it, expect, vi, beforeEach } from 'vitest';

type InMemItem = { id: string; userId: string; accessToken: string; institutionName?: string | null };
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
  isActive?: boolean;
};

let prismaMockGlobal: any;

vi.mock('../lib/db', () => ({ prisma: prismaMockGlobal }));
vi.mock('../lib/plaid', () => ({
  getPlaidClient: () => ({
    accountsBalanceGet: vi.fn(async ({ access_token }: any) => {
      const r = (globalThis as any).__P_RESOLVER__ as (t: string) => any;
      const data = r(access_token);
      if (data instanceof Error) throw data;
      return { data } as any;
    }),
  }),
}));
vi.mock('../lib/encryption', () => ({ decryptMessage: (s: string) => s }));

describe('balances breakdown (cash vs credit)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function setupDb() {
    const items: InMemItem[] = [];
    const accounts: InMemAccount[] = [];

    const prismaMock = {
      plaidItem: {
        findMany: vi.fn(async (args: any) => {
          const where = args?.where ?? {};
          return items.filter(i => !where.userId || i.userId === where.userId).map(i => ({ id: i.id, accessToken: i.accessToken, institutionName: i.institutionName ?? null }));
        }),
        update: vi.fn(async () => {}),
      },
      plaidAccount: {
        upsert: vi.fn(async (args: any) => {
          const whereId = args.where.accountId as string;
          const existing = accounts.find(a => a.accountId === whereId);
          if (existing) {
            Object.assign(existing, {
              name: args.update.name ?? existing.name,
              officialName: args.update.officialName ?? existing.officialName,
              mask: args.update.mask ?? existing.mask,
              type: args.update.type ?? existing.type,
              subtype: args.update.subtype ?? existing.subtype,
              currency: args.update.currency ?? existing.currency,
              currentBalance: args.update.currentBalance ?? existing.currentBalance,
              availableBalance: args.update.availableBalance ?? existing.availableBalance,
              isActive: existing.isActive ?? true,
            });
            const s = args.select;
            if (!s) return { ...existing };
            const out: any = {}; for (const k of Object.keys(s)) if (s[k]) out[k] = (existing as any)[k];
            return out;
          }
          const c = args.create;
          const row: InMemAccount = {
            id: `acc_${Math.random().toString(36).slice(2, 8)}`,
            itemId: c.itemId,
            accountId: c.accountId,
            name: c.name ?? 'Account',
            officialName: c.officialName ?? null,
            mask: c.mask ?? null,
            type: c.type ?? 'unknown',
            subtype: c.subtype ?? null,
            currency: c.currency ?? null,
            currentBalance: c.currentBalance ?? null,
            availableBalance: c.availableBalance ?? null,
            isActive: true,
          };
          accounts.push(row);
          const s = args.select; if (!s) return { ...row };
          const out: any = {}; for (const k of Object.keys(s)) if (s[k]) out[k] = (row as any)[k];
          return out;
        }),
        findMany: vi.fn(async (args: any) => {
          const where = args?.where ?? {};
          const inIds: string[] = where?.itemId?.in ?? [];
          const typeEq: string | undefined = where?.type;
          const filtered = accounts.filter(a => (inIds.length ? inIds.includes(a.itemId) : true)
            && (where?.isActive ? a.isActive !== false : true)
            && (typeEq ? a.type === typeEq : true));
          const s = args.select; if (!s) return filtered.map(a => ({ ...a }));
          return filtered.map(a => { const o: any = {}; for (const k of Object.keys(s)) if (s[k]) o[k] = (a as any)[k]; return o; });
        }),
      },
    } as any;
    prismaMockGlobal = prismaMock;
    return { items, accounts };
  }

  function setPlaidResolver(fn: (token: string) => any) {
    (globalThis as any).__P_RESOLVER__ = fn;
  }

  it('computes cash and credit totals separately', async () => {
    const { items } = setupDb();
    items.push(
      { id: 'it1', userId: 'u1', accessToken: 't1', institutionName: 'Bank A' },
      { id: 'it2', userId: 'u1', accessToken: 't2', institutionName: 'Bank B' },
    );
    setPlaidResolver((t) => {
      if (t === 't1') return { accounts: [
        { account_id: 'a1', name: 'Chk', type: 'depository', subtype: 'checking', balances: { iso_currency_code: 'USD', available: 900, current: 1000 } },
        { account_id: 'a2', name: 'Sav', type: 'depository', subtype: 'savings', balances: { iso_currency_code: 'USD', available: null, current: 600 } },
      ] };
      if (t === 't2') return { accounts: [
        { account_id: 'c1', name: 'Card', type: 'credit', subtype: 'credit card', balances: { iso_currency_code: 'USD', current: -1200, available: null } },
      ] };
      return { accounts: [] };
    });

    const { getBalancesBreakdown } = await import('../lib/balances');
    const res = await getBalancesBreakdown({ userId: 'u1' });
    expect(res.cash.count).toBe(2);
    expect(Math.round(res.cash.total)).toBe(1500);
    expect(res.credit.count).toBe(1);
    expect(Math.round(res.credit.owedTotal)).toBe(1200);
  });
});


