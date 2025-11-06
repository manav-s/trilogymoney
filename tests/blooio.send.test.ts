import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const originalFetch = global.fetch;

const prismaMock = {
  user: {
    findUnique: vi.fn(),
  },
  message: {
    create: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/encryption', () => ({ encryptMessage: vi.fn((text: string) => `enc:${text}`) }));

describe('sendMessage persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('BLOOIO_API_KEY', 'test-key');
    prismaMock.user.findUnique.mockReset();
    prismaMock.message.create.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(prismaMock.message.create.mock.calls[0][0].data).toMatchObject({
      userId: 'user-1',
      direction: 'outbound',
    });
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
});


