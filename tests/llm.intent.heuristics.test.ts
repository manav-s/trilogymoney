import { describe, it, expect, beforeEach, vi } from 'vitest';

function mockFetch(response: unknown) {
  const body = JSON.stringify(response);
  const fn = vi.fn(async () => new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
  // @ts-expect-error mutate global
  global.fetch = fn;
  return fn;
}

describe('chooseIntentFromText heuristics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('routes institution questions to balances without hitting OpenAI', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    const fetchSpy = vi.fn(() => {
      throw new Error('OpenAI should not be called when heuristics match');
    });
    // @ts-expect-error mutate global
    global.fetch = fetchSpy;
    const { chooseIntentFromText } = await import('../lib/llm');
    const intent = await chooseIntentFromText('which bank or institution do i have?');
    expect(intent).toBe('balances');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('routes credit card questions to balances without hitting OpenAI', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    const fetchSpy = vi.fn(() => {
      throw new Error('OpenAI should not be called when heuristics match');
    });
    // @ts-expect-error mutate global
    global.fetch = fetchSpy;
    const { chooseIntentFromText } = await import('../lib/llm');
    const intent = await chooseIntentFromText('which card do i use?');
    expect(intent).toBe('balances');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('routes general transaction questions to transactions intent', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    mockFetch({ choices: [{ message: { content: 'transactions' } }] });
    const { chooseIntentFromText } = await import('../lib/llm');
    const intent = await chooseIntentFromText('show me my transactions');
    expect(intent).toBe('transactions');
  });
});


