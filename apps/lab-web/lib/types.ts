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
export type CategoryMap = Record<TransactionType, string[]>;

export interface MonthlySummary {
  income: number;
  expense: number;
  balance: number;
}

export type MonthlyBudgetMap = Record<string, number>;

export interface MonthlyBudgetProgress {
  budget: number;
  spent: number;
  remaining: number;
  isOverBudget: boolean;
  progressRate: number;
}
