import { getPlaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/db';
import { decryptMessage } from '@/lib/encryption';
import { logError } from '@/lib/logger';
import type { TransactionsRecurringGetResponse } from 'plaid';

export type RecurringSeries = {
  merchant: string;
  frequency: string;
  averageAmount: number;
  nextDate: string | null;
  lastDate: string | null;
  category: string | null;
  status: 'upcoming' | 'completed';
};

export async function getRecurringTransactions(userId: string): Promise<RecurringSeries[]> {
  const client = getPlaidClient();
  const items = await prisma.plaidItem.findMany({ where: { userId } });
  const series: RecurringSeries[] = [];

  for (const item of items) {
    try {
      const accessToken = decryptMessage(item.accessToken);
      const resp = await client.transactionsRecurringGet({ access_token: accessToken });
      const data = resp.data as TransactionsRecurringGetResponse;
      const inflows = data.inflows ?? [];
      const outflows = data.outflows ?? [];

      for (const s of [...inflows, ...outflows]) {
        series.push({
          merchant: s.merchant_name ?? s.personal_finance_category?.primary ?? 'unknown merchant',
          frequency: s.frequency ?? 'unknown',
          averageAmount: typeof s.average_amount === 'number' ? Math.round(s.average_amount) : 0,
          nextDate: s.next_date ?? null,
          lastDate: s.last_date ?? null,
          category: s.personal_finance_category?.primary ?? null,
          status: s.status?.toLowerCase() === 'upcoming' ? 'upcoming' : 'completed',
        });
      }
    } catch (error) {
      logError('recurring.fetch', error, { itemId: item.id, userId });
    }
  }

  return series;
}

