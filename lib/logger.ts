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


