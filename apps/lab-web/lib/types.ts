export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  category: string;
  amount: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export type TransactionFilter = 'all' | TransactionType;

export interface MonthlySummary {
  income: number;
  expense: number;
  balance: number;
}
