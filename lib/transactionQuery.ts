const DEFAULT_LOOKBACK_DAYS = 30;

export type TransactionQuery =
  | { kind: 'recent'; limit: number; from: string; to: string }
  | { kind: 'merchantSpend'; limit: number; merchant: string | null; from: string; to: string };

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isoDate(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10);
}

function daysAgo(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function getDefaultRange(now = new Date()): { from: string; to: string } {
  const to = isoDate(now);
  const from = isoDate(daysAgo(DEFAULT_LOOKBACK_DAYS, now));
  return { from, to };
}

function getLastMonthRange(now = new Date()): { from: string; to: string } {
  const firstOfCurrent = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayPrev = new Date(firstOfCurrent.getTime() - 24 * 60 * 60 * 1000);
  const firstPrev = new Date(lastDayPrev.getFullYear(), lastDayPrev.getMonth(), 1);
  return { from: isoDate(firstPrev), to: isoDate(lastDayPrev) };
}

function getPastDaysRange(days: number, now = new Date()): { from: string; to: string } {
  return { from: isoDate(daysAgo(days, now)), to: isoDate(now) };
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

function parseSinceMonth(text: string, now = new Date()): { from: string; to: string } | null {
  const match = text.match(/since\s+([a-z]+)(?:\s+(\d{1,2}))?/i);
  if (!match) return null;
  const monthName = match[1].toLowerCase();
  const monthIndex = MONTHS.indexOf(monthName);
  if (monthIndex === -1) return null;
  const day = match[2] ? Math.min(parseInt(match[2], 10), 31) : 1;
  const fromDate = new Date(now.getFullYear(), monthIndex, day);
  if (fromDate > now) {
    fromDate.setFullYear(fromDate.getFullYear() - 1);
  }
  return { from: isoDate(fromDate), to: isoDate(now) };
}

function clampDays(value: number, min = 1, max = 365): number {
  return Math.max(min, Math.min(max, value));
}

function cleanMerchantHint(raw: string): string | null {
  let hint = raw.trim();
  hint = hint.replace(/[?.!,]/g, ' ').replace(/\s+/g, ' ');
  const stopWords = ['during', 'over', 'last', 'this', 'the', 'for', 'in', 'on', 'of', 'at'];
  const tokens = hint.split(' ');
  const filtered: string[] = [];
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (stopWords.includes(lower)) break;
    filtered.push(token);
  }
  hint = filtered.join(' ').trim();
  if (!hint) return null;
  if (hint.length < 2) return null;
  if (['the', 'my'].includes(hint.toLowerCase())) return null;
  return hint.slice(0, 60);
}

function extractMerchant(original: string): string | null {
  const patterns = [
    /\b(?:spent|spend|spending|charges?|purchases?)\s+(?:at|on|from|with)\s+([A-Za-z0-9&'’.\- ]{3,60})/i,
    /\b(?:at|on|from)\s+([A-Za-z][A-Za-z0-9&'’.\- ]{2,60})/i,
  ];
  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match) {
      const candidate = cleanMerchantHint(match[1]);
      if (candidate) return candidate;
    }
  }
  return null;
}

export function parseTransactionsQuery(userText: string, now = new Date()): TransactionQuery {
  const lower = userText.toLowerCase();
  const defaultRange = getDefaultRange(now);
  const merchant = extractMerchant(userText);

  let range: { from: string; to: string } | null = null;

  if (/\blast month\b/.test(lower)) {
    range = getLastMonthRange(now);
  } else if (/\blast week\b/.test(lower)) {
    range = getPastDaysRange(7, now);
  } else if (/\bpast\s+(\d+)\s+days?\b/.test(lower)) {
    const days = clampDays(parseInt(RegExp.$1, 10));
    range = getPastDaysRange(days, now);
  } else if (/\bpast\s+(\d+)\s+weeks?\b/.test(lower)) {
    const weeks = clampDays(parseInt(RegExp.$1, 10) * 7, 7, 365);
    range = getPastDaysRange(weeks, now);
  } else if (/\bpast\s+(\d+)\s+months?\b/.test(lower)) {
    const months = clampDays(parseInt(RegExp.$1, 10), 1, 12);
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    range = { from: isoDate(start), to: isoDate(now) };
  } else if (/\b(?:past|last)\s+30\s+days\b/.test(lower)) {
    range = getPastDaysRange(30, now);
  } else {
    const sinceRange = parseSinceMonth(lower, now);
    if (sinceRange) range = sinceRange;
  }

  const wantsSpend =
    /\bspen[dt]\b/.test(lower) ||
    /\bpurchase(?:s|d)?\b/.test(lower) ||
    /\bcharges?\b/.test(lower);

  if (merchant || wantsSpend || range) {
    const finalRange = range ?? defaultRange;
    return {
      kind: 'merchantSpend',
      limit: 100,
      merchant: merchant,
      from: finalRange.from,
      to: finalRange.to,
    };
  }

  return {
    kind: 'recent',
    limit: 3,
    from: defaultRange.from,
    to: defaultRange.to,
  };
}


