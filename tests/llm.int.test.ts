import { describe, it, expect, vi, beforeEach } from 'vitest';

// Utility to stub global fetch per URL
function mockFetch(handlers: Record<string, (input: RequestInfo, init?: RequestInit) => Promise<Response>>) {
  const fn = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    const handler = handlers[url];
    if (!handler) throw new Error(`No fetch handler for ${url}`);
    return handler(input, init);
  });
  // @ts-expect-error assign global
  global.fetch = fn;
  return fn;
}

function jsonResponse(obj: unknown, init?: number | ResponseInit) {
  const body = JSON.stringify(obj);
  const status = typeof init === 'number' ? init : init?.status ?? 200;
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

describe('lib/llm generateReply integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('returns sorry message when API key missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { generateReply } = await import('../lib/llm');
    const out = await generateReply('balances', { userText: 'hi' });
    expect(out).toMatch(/sorry the model is having trouble/i);
  });

  it('returns text when chat completions yields content', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    const base = 'https://api.openai.com/v1';
    mockFetch({
      [`${base}/chat/completions`]: async () => jsonResponse({ choices: [ { message: { content: 'hello there' } } ] }),
    });
    const { generateReply } = await import('../lib/llm');
    const out = await generateReply('balances', { userText: 'hi' });
    expect(out).toContain('hello there');
  });

  it('falls back to Responses API when chat completion content is empty', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    const base = 'https://api.openai.com/v1';
    mockFetch({
      [`${base}/chat/completions`]: async () => jsonResponse({ choices: [ { message: { content: '' } } ] }),
      [`${base}/responses`]: async () => jsonResponse({ output_text: 'hi from responses' }),
    });
    const { generateReply } = await import('../lib/llm');
    const out = await generateReply('balances', { userText: 'hi' });
    expect(out).toContain('hi from responses');
  });

  it('returns sorry on 429/400 errors', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    const base = 'https://api.openai.com/v1';
    mockFetch({
      [`${base}/chat/completions`]: async () => new Response('{"error":"quota"}', { status: 429 }),
    });
    const { generateReply } = await import('../lib/llm');
    const out = await generateReply('balances', { userText: 'hi' });
    expect(out).toMatch(/sorry the model is having trouble/i);
  });
});

