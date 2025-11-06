import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const originalFetch = global.fetch;
const encryptSpy = vi.fn((text: string) => `enc:${text}`);

const prismaMock = {
  user: {
    findUnique: vi.fn(),
  },
  message: {
    create: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/encryption', () => ({ encryptMessage: encryptSpy }));

describe('sendMessage persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('BLOOIO_API_KEY', 'test-key');
    vi.useFakeTimers();
    prismaMock.user.findUnique.mockReset();
    prismaMock.message.create.mockReset();
    encryptSpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  function mockFetch(responseBody: any, status = 200) {
    const res = new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'content-type': 'application/json' },
    });
    const fetchSpy = vi.fn(async () => res.clone());
    // @ts-expect-error override global fetch
    global.fetch = fetchSpy;
    return fetchSpy;
  }

  it('stores outbound message when userId provided', async () => {
    mockFetch({ id: 'msg-1' });
    prismaMock.message.create.mockResolvedValue({});

    const { sendMessage } = await import('../lib/blooio');
    await sendMessage({ to: '+15551234567', body: 'hi there', userId: 'user-1' });

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.message.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.message.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: 'user-1',
      direction: 'outbound',
      providerId: 'msg-1',
      status: 'sent',
    });
    expect(encryptSpy).toHaveBeenCalledWith('hi there');
    expect(data.content).toBe('enc:hi there');
  });

  it('looks up user by phone when userId missing', async () => {
    mockFetch({ id: 'msg-2' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-2' });
    prismaMock.message.create.mockResolvedValue({});

    const { sendMessage } = await import('../lib/blooio');
    await sendMessage({ to: '+15551234568', body: 'hello' });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { phone: '+15551234568' } });
    expect(prismaMock.message.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.message.create.mock.calls[0][0].data.userId).toBe('user-2');
  });

  it('skips persistence when user not found', async () => {
    mockFetch({ id: 'msg-3' });
    prismaMock.user.findUnique.mockResolvedValue(null);

    const { sendMessage } = await import('../lib/blooio');
    await sendMessage({ to: '+15551234569', body: 'hey' });

    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it('swallows prisma errors after sending', async () => {
    mockFetch({ id: 'msg-4' });
    prismaMock.message.create.mockRejectedValue(new Error('db down'));

    const { sendMessage } = await import('../lib/blooio');
    await expect(sendMessage({ to: '+15551234570', body: 'ok', userId: 'user-4' })).resolves.toBeTruthy();
  });

  it('sets expiresAt approx 60 days out', async () => {
    const base = new Date('2025-01-01T00:00:00Z');
    vi.setSystemTime(base);
    mockFetch({ id: 'msg-5' });
    prismaMock.message.create.mockResolvedValue({});

    const { sendMessage } = await import('../lib/blooio');
    await sendMessage({ to: '+15551234571', body: 'timed', userId: 'user-5' });

    const expiresAt = prismaMock.message.create.mock.calls[0][0].data.expiresAt as Date;
    const diff = expiresAt.getTime() - base.getTime();
    expect(diff).toBeGreaterThan(59 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(61 * 24 * 60 * 60 * 1000);
  });

  it('does not attempt persistence when API call fails', async () => {
    vi.useRealTimers();
    mockFetch({ error: 'oops' }, 500);

    const { sendMessage } = await import('../lib/blooio');
    const promise = sendMessage({ to: '+15551234572', body: 'fail' });
    await expect(promise).rejects.toThrow();
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });
});


