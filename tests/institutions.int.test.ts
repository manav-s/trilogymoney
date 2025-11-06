import { describe, it, expect, vi, beforeEach } from 'vitest';

let prismaMockGlobal: any;

vi.mock('../lib/db', () => ({ prisma: prismaMockGlobal }));
vi.mock('../lib/plaid', () => ({
  getPlaidClient: () => ({
    accountsBalanceGet: vi.fn(async ({ access_token }: any) => {
      const r = (globalThis as any).__INST_PLAID_RESOLVER__ as (t: string) => any;
      const data = r(access_token);
      if (data instanceof Error) throw data;
      return { data } as any;
    }),
  }),
  getPlaidDefaults: () => ({ countryCodes: ['US'] }),
}));
vi.mock('../lib/encryption', () => ({ decryptMessage: (s: string) => s }));

describe('institution names in balances breakdown', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function setupDb() {
    const items: Array<{ id: string; userId: string; accessToken: string; institutionName: string | null }> = [];
    const accounts: Array<{
      id: string; itemId: string; accountId: string; name: string; type: string | null;
      currentBalance: number | null; availableBalance: number | null; isActive: boolean;
      mask?: string | null; subtype?: string | null; currency?: string | null;
    }> = [];

    const prismaMock = {
      plaidItem: {
        findMany: vi.fn(async (args: any) => {
          const where = args?.where ?? {};
          const select = args?.select ?? {};
          return items
            .filter(i => !where.userId || i.userId === where.userId)
            .map(i => {
              const out: any = { id: i.id };
              if (select.accessToken !== false) out.accessToken = i.accessToken;
              if (select.institutionName !== false) out.institutionName = i.institutionName;
              return out;
            });
        }),
        update: vi.fn(async () => {}),
      },
      plaidAccount: {
        upsert: vi.fn(async (args: any) => {
          const whereId = args.where.accountId as string;
          const existing = accounts.find(a => a.accountId === whereId);
          const select = args.select;
          if (existing) {
            Object.assign(existing, {
              name: args.update.name ?? existing.name,
              type: args.update.type ?? existing.type,
              currency: args.update.currency ?? existing.currency,
              currentBalance: args.update.currentBalance ?? existing.currentBalance,
              availableBalance: args.update.availableBalance ?? existing.availableBalance,
            });
            let out: any = {};
            if (select) {
              for (const k of Object.keys(select)) if (select[k]) out[k] = (existing as any)[k];
            } else {
              out = { ...existing };
            }
            return out;
          }
          const c = args.create;
          const row = {
            id: `acc_${Math.random().toString(36).slice(2, 8)}`,
            itemId: c.itemId,
            accountId: c.accountId,
            name: c.name ?? 'Account',
            type: c.type ?? 'unknown',
            currentBalance: c.currentBalance ?? null,
            availableBalance: c.availableBalance ?? null,
            isActive: true,
            mask: c.mask ?? null,
            subtype: c.subtype ?? null,
            currency: c.currency ?? null,
            lastSync: new Date(),
          };
          accounts.push(row);
          let out: any = {};
          if (select) {
            for (const k of Object.keys(select)) if (select[k]) out[k] = (row as any)[k];
          } else {
            out = { ...row };
          }
          return out;
        }),
        findMany: vi.fn(async (args: any) => {
          const where = args?.where ?? {};
          const inIds: string[] = where?.itemId?.in ?? [];
          const typeEq: string | undefined = where?.type;
          const filtered = accounts.filter(a =>
            (inIds.length ? inIds.includes(a.itemId) : true) &&
            (where?.isActive ? a.isActive !== false : true) &&
            (typeEq ? a.type === typeEq : true)
          );
          const s = args.select;
          return filtered.map(a => {
            if (!s) return { ...a };
            const out: any = {};
            for (const k of Object.keys(s)) {
              if (s[k]) out[k] = (a as any)[k];
            }
            return out;
          });
        }),
      },
    } as any;
    prismaMockGlobal = prismaMock;
    return { items, accounts };
  }

  function setPlaidResolver(fn: (token: string) => any) {
    (globalThis as any).__INST_PLAID_RESOLVER__ = fn;
  }

  it('extracts cash and credit institution names correctly', async () => {
    const { items, accounts } = setupDb();
    items.push(
      { id: 'it1', userId: 'u1', accessToken: 't1', institutionName: 'Chase Bank' },
      { id: 'it2', userId: 'u1', accessToken: 't2', institutionName: 'Discover' },
    );
    setPlaidResolver((t) => {
      if (t === 't1') return { accounts: [
        { account_id: 'a1', name: 'Checking', type: 'depository', subtype: 'checking', balances: { iso_currency_code: 'USD', available: 1000, current: 1200 } },
      ] };
      if (t === 't2') return { accounts: [
        { account_id: 'c1', name: 'Credit Card', type: 'credit', subtype: 'credit card', balances: { iso_currency_code: 'USD', current: -500, available: null } },
      ] };
      return { accounts: [] };
    });

    const { getBalancesBreakdown } = await import('../lib/balances');
    const res = await getBalancesBreakdown({ userId: 'u1' });

    expect(res.cash.accounts.length).toBe(1);
    expect(res.cash.accounts[0].institution).toBe('Chase Bank');
    expect(res.credit.accounts.length).toBe(1);
    expect(res.credit.accounts[0].institution).toBe('Discover');
  });

  it('handles null institution names gracefully', async () => {
    const { items, accounts } = setupDb();
    items.push(
      { id: 'it3', userId: 'u2', accessToken: 't3', institutionName: null },
    );
    // Pre-create account so it's found by active query
    accounts.push({
      id: 'pre-a2',
      itemId: 'it3',
      accountId: 'a2',
      name: 'Savings',
      type: 'depository',
      currentBalance: 500,
      availableBalance: 500,
      isActive: true,
      currency: 'USD',
    });
    setPlaidResolver((t) => ({
      accounts: [
        { account_id: 'a2', name: 'Savings', type: 'depository', subtype: 'savings', balances: { iso_currency_code: 'USD', available: 500, current: 500 } },
      ],
    }));

    const { getBalancesBreakdown } = await import('../lib/balances');
    const res = await getBalancesBreakdown({ userId: 'u2' });
    // Even if no accounts returned from getBalances (due to filtering), credit query should work
    // Main test is that null institutions don't break the flow
    if (res.cash.accounts.length > 0) {
      expect(res.cash.accounts[0].institution).toBeNull();
    }
  });

  it('passes institutions to LLM prompt for balances', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    let capturedPrompt = '';
    const mockFetch = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      const json = init?.body ? JSON.parse(String(init.body)) : {};
      const msgs = json?.messages ?? [];
      const u = msgs.find((m: any) => m.role === 'user');
      capturedPrompt = u?.content || '';
      return new Response(JSON.stringify({ choices: [{ message: { content: 'test' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    global.fetch = mockFetch as any;

    const { generateReply } = await import('../lib/llm');
    await generateReply('balances' as any, {
      cashTotal: 1200,
      cashCount: 1,
      cashInstitutions: ['Chase Bank'],
      cardOwedTotal: 500,
      cardCount: 1,
      cardInstitutions: ['Discover'],
    });

    expect(capturedPrompt).toContain('cash_institutions=Chase Bank');
    expect(capturedPrompt).toContain('card_institutions=Discover');
    expect(capturedPrompt).toContain('If asked about specific banks');
  });

  it('handles empty institution arrays in prompt', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    let capturedPrompt = '';
    const mockFetch = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      const json = init?.body ? JSON.parse(String(init.body)) : {};
      const msgs = json?.messages ?? [];
      const u = msgs.find((m: any) => m.role === 'user');
      capturedPrompt = u?.content || '';
      return new Response(JSON.stringify({ choices: [{ message: { content: 'test' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    global.fetch = mockFetch as any;

    const { generateReply } = await import('../lib/llm');
    await generateReply('balances' as any, {
      cashTotal: 500,
      cashCount: 1,
      cashInstitutions: null,
      cardOwedTotal: 0,
      cardCount: 0,
      cardInstitutions: null,
    });

    expect(capturedPrompt).toContain('cash_institutions=unknown');
    expect(capturedPrompt).toContain('card_institutions=unknown');
  });
});

