export type TransactionQuery =
  | { kind: 'recent'; limit: number; from: string; to: string }
  | { kind: 'merchantSpend'; limit: number; merchant: string | null; from: string; to: string };
