import { describe, it, expect, vi, beforeEach } from 'vitest';

function captureFetch(fn: (json: any) => void) {
  const impl = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
    const json = init?.body ? JSON.parse(String(init.body)) : {};
    fn(json);
    return new Response(JSON.stringify({ choices: [ { message: { content: 'ok' } } ] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  // @ts-expect-error mutate global
  global.fetch = impl;
}

describe('LLM balances prompt includes cash+cards fields', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('passes breakdown fields to the user message', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    let userContent = '';
    captureFetch((json) => {
      const msgs = json?.messages ?? [];
      const u = msgs.find((m: any) => m.role === 'user');
      userContent = u?.content || '';
    });
    const { generateReply } = await import('../lib/llm');
    const out = await generateReply('balances' as any, {
      cashTotal: 1500,
      cashCount: 2,
      cardOwedTotal: 1200,
      cardCount: 1,
    });
    expect(out).toBe('ok');
    expect(userContent).toContain('cash_total=1500');
    expect(userContent).toContain('cash_accounts=2');
    expect(userContent).toContain('cards_owed=1200');
    expect(userContent).toContain('cards=1');
  });
});


