import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

function mockFetch(body: unknown, status = 200) {
  const fetchSpy = vi.fn(async () => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
  // @ts-expect-error override global fetch for tests
  global.fetch = fetchSpy;
  return fetchSpy;
}

describe('lib/blooio sendMessage persistence flags', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('BLOOIO_API_KEY', 'test-key');
    vi.useRealTimers();
    prismaMock.user.findUnique.mockReset();
    prismaMock.message.create.mockReset();
    encryptSpy.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('persists when shouldPersist=true and userId provided', async () => {
    mockFetch({ id: 'msg-1' });
    prismaMock.message.create.mockResolvedValue({});

    const { sendMessage } = await import('../lib/blooio');
    await sendMessage({ to: '+15551230000', body: 'paid message', userId: 'user-1', shouldPersist: true });

    expect(prismaMock.message.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.message.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: 'user-1',
      direction: 'outbound',
      providerId: 'msg-1',
    });
    expect(encryptSpy).toHaveBeenCalledWith('paid message');
    expect(data.content).toBe('enc:paid message');
  });

  it('does not persist when shouldPersist is false', async () => {
    mockFetch({ id: 'msg-2' });

    const { sendMessage } = await import('../lib/blooio');
    await sendMessage({ to: '+15551230001', body: 'free message', userId: 'user-2', shouldPersist: false });

    expect(prismaMock.message.create).not.toHaveBeenCalled();
    expect(encryptSpy).not.toHaveBeenCalled();
  });

  it('looks up user when userId missing but shouldPersist=true', async () => {
    mockFetch({ id: 'msg-3' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-3' });
    prismaMock.message.create.mockResolvedValue({});

    const { sendMessage } = await import('../lib/blooio');
    await sendMessage({ to: '+15551230002', body: 'lookup message', shouldPersist: true });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { phone: '+15551230002' } });
    expect(prismaMock.message.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.message.create.mock.calls[0][0].data.userId).toBe('user-3');
  });

  it('skips persistence when lookup returns no user', async () => {
    mockFetch({ id: 'msg-4' });
    prismaMock.user.findUnique.mockResolvedValue(null);

    const { sendMessage } = await import('../lib/blooio');
    await sendMessage({ to: '+15551230003', body: 'orphan message', shouldPersist: true });

    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it('ignores prisma errors after successful send', async () => {
    mockFetch({ id: 'msg-5' });
    prismaMock.message.create.mockRejectedValue(new Error('db down'));

    const { sendMessage } = await import('../lib/blooio');
    await expect(sendMessage({ to: '+15551230004', body: 'resilient', userId: 'user-4', shouldPersist: true })).resolves.toBeTruthy();
  });

  it('sets expiresAt roughly 60 days out when persisting', async () => {
    vi.useFakeTimers();
    const base = new Date('2025-01-01T00:00:00Z');
    vi.setSystemTime(base);
    mockFetch({ id: 'msg-6' });
    prismaMock.message.create.mockResolvedValue({});

    const { sendMessage } = await import('../lib/blooio');
    await sendMessage({ to: '+15551230005', body: 'timed', userId: 'user-5', shouldPersist: true });

    const expiresAt = prismaMock.message.create.mock.calls[0][0].data.expiresAt as Date;
    const diff = expiresAt.getTime() - base.getTime();
    expect(diff).toBeGreaterThan(59 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(61 * 24 * 60 * 60 * 1000);
    vi.useRealTimers();
  });

  it('does not attempt persistence when Blooio API fails', async () => {
    mockFetch({ error: 'oops' }, 500);

    const { sendMessage } = await import('../lib/blooio');
    await expect(sendMessage({ to: '+15551230006', body: 'fail path', shouldPersist: true })).rejects.toThrow();
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });
});


