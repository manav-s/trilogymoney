type Primitive = string | number | boolean | null | undefined;

type LogMeta = Record<string, unknown> | undefined;

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***-***-${digits.slice(-4)}`;
}

function shouldRedactKey(key: string): boolean {
  return /(^|_)(token|secret|password|authorization|api.?key|access.?token|key)($|_)/i.test(key);
}

function redactPrimitive(key: string, value: Primitive): Primitive {
  if (typeof value === 'string') {
    if (shouldRedactKey(key)) return '[redacted]';
    if (key.toLowerCase() === 'phone' || key.toLowerCase() === 'to') return maskPhone(value);
    if (/bearer\s+\S+/i.test(value)) return 'Bearer [redacted]';
    if (value.length > 500) return value.slice(0, 500) + '…';
  }
  return value;
}

function safeSerialize(obj: unknown): unknown {
  try {
    if (obj == null) return obj;
    if (typeof obj !== 'object') return obj;
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      if (value == null) return value;
      if (typeof value !== 'object') return redactPrimitive(key, value as Primitive);
      if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' && v.length > 500 ? v.slice(0, 500) + '…' : v));
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'string') out[k] = redactPrimitive(k, v);
        else if (v && typeof v === 'object') out[k] = safeSerialize(v);
        else out[k] = v;
      }
      return out;
    }));
  } catch {
    return '[unserializable]';
  }
}

function serializeError(err: unknown): { name?: string; message?: string; stack?: string } | undefined {
  if (!err) return undefined;
  try {
    if (err instanceof Error) {
      const stack = typeof err.stack === 'string' ? err.stack.split('\n').slice(0, 8).join('\n') : undefined;
      return { name: err.name, message: err.message, stack };
    }
    if (typeof err === 'string') {
      return { name: 'Error', message: err };
    }
    return { name: 'Error', message: '[non-error thrown]' };
  } catch {
    return { name: 'Error', message: '[failed to serialize error]' };
  }
}

export function logError(scope: string, err?: unknown, context?: LogMeta): string {
  const id = generateId();
  const payload = {
    level: 'error' as const,
    ts: new Date().toISOString(),
    id,
    scope,
    error: serializeError(err),
    context: safeSerialize(context),
  };
  try {
    // Minimal formatting; avoid logging sensitive data by construction above
    console.error(JSON.stringify(payload));
  } catch {
    console.error(`[error-log-failed] ${scope}`);
  }
  return id;
}

type LogLevel = 'info' | 'warn' | 'error';

const isDev = process.env.NODE_ENV !== 'production';

function log(level: LogLevel, message: string, meta?: unknown) {
  if (!isDev) return; // no-op in production
  const prefix = `[${level.toUpperCase()}]`;
  if (level === 'info') console.log(prefix, message, meta ?? '');
  if (level === 'warn') console.warn(prefix, message, meta ?? '');
  if (level === 'error') console.error(prefix, message, meta ?? '');
}

export const logger = {
  info: (msg: string, meta?: unknown) => log('info', msg, meta),
  warn: (msg: string, meta?: unknown) => log('warn', msg, meta),
  error: (msg: string, meta?: unknown) => log('error', msg, meta),
};


