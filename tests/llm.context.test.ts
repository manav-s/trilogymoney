import { describe, it, expect, vi, beforeEach } from 'vitest';

function mockFetchCapture(bodyHandler: (json: any) => void) {
  const fn = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
    const json = init?.body ? JSON.parse(String(init.body)) : {};
    bodyHandler(json);
    return new Response(JSON.stringify({ choices: [ { message: { content: 'ok' } } ] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  // @ts-expect-error mutate global for tests
  global.fetch = fn;
  return fn;
}

describe('llm prompt includes onboarding context', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('injects profile, quizAnswers, and analysisSummary', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    let capturedUserContent = '';
    mockFetchCapture((json) => {
      const msgs = json?.messages ?? [];
      const userMsg = msgs.find((m: any) => m.role === 'user');
      capturedUserContent = userMsg?.content || '';
    });

    const { generateReply } = await import('../lib/llm');
    const out = await generateReply('chat' as any, {
      userText: 'hi',
      history: 'you: hi',
      profile: { name: 'Alex', timezone: 'America/New_York', preferredTime: '08:00' },
      quizAnswers: { goal: 'save', risk: 'low' },
      analysisSummary: { score: 7, bullets: ['stable cash flow'] },
    });

    expect(out).toBe('ok');
    expect(capturedUserContent).toContain('Profile: name=Alex');
    expect(capturedUserContent).toContain('tz=America/New_York');
    expect(capturedUserContent).toContain('Quiz:');
    expect(capturedUserContent).toContain('Analysis:');
  });

  it('truncates very long quiz/analysis blobs', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    let capturedUserContent = '';
    mockFetchCapture((json) => {
      const msgs = json?.messages ?? [];
      const userMsg = msgs.find((m: any) => m.role === 'user');
      capturedUserContent = userMsg?.content || '';
    });

    const veryLong = 'x'.repeat(1000);
    const { generateReply } = await import('../lib/llm');
    await generateReply('chat' as any, {
      userText: 'hello',
      history: '',
      quizAnswers: { note: veryLong },
      analysisSummary: { note: veryLong },
    });

    // should include an ellipsis to indicate truncation
    expect(capturedUserContent).toContain('…');
  });

  it('formats transactions prompt with context', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    let capturedUserContent = '';
    mockFetchCapture((json) => {
      const msgs = json?.messages ?? [];
      const userMsg = msgs.find((m: any) => m.role === 'user');
      capturedUserContent = userMsg?.content || '';
    });

    const { generateReply } = await import('../lib/llm');
    const out = await generateReply('transactions' as any, {
      transactions: [
        {
          id: 'tx-1',
          date: '2025-11-05',
          amount: 42.13,
          currency: 'USD',
          merchant: 'CVS',
          description: 'CVS STORE',
          category: 'HEALTHCARE',
          pending: false,
          account: { id: 'acc-1', name: 'Checking', institution: 'Bank', mask: '1234' },
        },
      ],
      moreAvailable: true,
      history: 'you: hi',
      userText: 'show recent charges',
      profile: { name: 'Alex' },
      query: { kind: 'merchantSpend', limit: 100, merchant: 'Amazon', from: '2025-10-01', to: '2025-10-31' },
    });

    expect(out).toBe('ok');
    expect(capturedUserContent).toContain('total spend in that window');
    expect(capturedUserContent).toContain('Focus on spend at "Amazon".');
    expect(capturedUserContent).toContain('Date range: 2025-10-01 to 2025-10-31.');
    expect(capturedUserContent).toContain('User question: "show recent charges".');
    expect(capturedUserContent).toContain('2025-11-05: spent USD42.13 at CVS');
    expect(capturedUserContent).toContain('More transactions exist beyond this list.');
  });
});


