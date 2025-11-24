import { getPlaidClient } from './plaid';
import { prisma } from './db';
import { decryptMessage } from './encryption';
import { logError } from './logger';

export type RecurringStream = {
  streamId: string;
  merchant: string;
  description: string | null;
  amount: number; // average amount
  frequency: string;
  lastDate: string | null;
  nextDate: string | null;
  status: string;
  category: string | null;
  accountName: string;
  institutionName: string;
  isActive: boolean;
};

/**
 * Fetch recurring outflow streams (subscriptions/bills) from Plaid and normalize.
 * Filters out zero/negative average amounts to reduce noise.
 */
export async function getRecurringStreams(userId: string): Promise<RecurringStream[]> {
  const items = await prisma.plaidItem.findMany({
    where: { userId },
    select: {
      id: true,
      accessToken: true,
      institutionName: true,
      accounts: { select: { accountId: true, name: true, mask: true } },
    },
  });
  if (!items.length) return [];

  const client = getPlaidClient();
  const streams: RecurringStream[] = [];

  for (const item of items) {
    let accessToken: string;
    try {
      accessToken = decryptMessage(item.accessToken);
    } catch (error) {
      logError('recurring.decrypt', error, { itemId: item.id });
      continue;
    }

    try {
      const resp = await client.transactionsRecurringGet({ access_token: accessToken });
      const accountMap = new Map(item.accounts.map((a) => [a.accountId, a.name || 'account']));
      const institutionName = item.institutionName || 'Unknown Bank';

      const processStreams = (rawStreams: Array<Record<string, unknown>> | undefined | null) => {
        if (!Array.isArray(rawStreams)) return;
        for (const s of rawStreams) {
          const avg = (s as { average_amount?: { amount?: number } }).average_amount?.amount ?? 0;
          if (!Number.isFinite(avg) || avg <= 0) continue;

          const merchant = (s as { merchant_name?: string; description?: string }).merchant_name;
          const description = (s as { description?: string }).description || null;
          const category =
            (s as { personal_finance_category?: { primary?: string } }).personal_finance_category?.primary ||
            ((s as { category?: string[] }).category?.[0] ?? null);

          streams.push({
            streamId: (s as { stream_id?: string }).stream_id || '',
            merchant: merchant || description || 'Unknown',
            description,
            amount: avg,
            frequency: (s as { frequency?: string }).frequency || 'UNKNOWN',
            lastDate: (s as { last_date?: string }).last_date || null,
            nextDate: (s as { predicted_next_date?: string }).predicted_next_date || null,
            status: (s as { status?: string }).status || 'UNKNOWN',
            category,
            accountName: ((s as { account_id?: string }).account_id && accountMap.get((s as { account_id?: string }).account_id!)) || 'Unknown Account',
            institutionName,
            isActive: (s as { status?: string }).status !== 'TERMINATED',
          });
        }
      };

      // Expenses/subscriptions only
      processStreams((resp.data as { outflow_streams?: unknown }).outflow_streams as Array<Record<string, unknown>>);
    } catch (error) {
      logError('recurring.fetch', error, { itemId: item.id });
    }
  }

  return streams;
}
