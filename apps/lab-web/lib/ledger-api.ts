import type { CategoryMap, MonthlyBudgetMap, Transaction } from '@/lib/types';

export type LedgerResource = 'transactions' | 'budgets' | 'categories';

export interface LedgerApiError {
  code: 'SHEETS_CONFIG_MISSING' | 'BAD_REQUEST' | 'INTERNAL_ERROR';
  message: string;
  missingEnv?: string[];
}

export type LedgerApiResponse<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: LedgerApiError;
    };

export interface TransactionsPayload {
  transactions: Transaction[];
}

export interface BudgetsPayload {
  monthlyBudgets: MonthlyBudgetMap;
}

export interface CategoriesPayload {
  customCategories: CategoryMap;
}

export interface LedgerState {
  transactions: Transaction[];
  monthlyBudgets: MonthlyBudgetMap;
  customCategories: CategoryMap;
}
