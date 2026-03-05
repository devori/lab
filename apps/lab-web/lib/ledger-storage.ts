import {
  BUDGET_STORAGE_KEY,
  CATEGORY_STORAGE_KEY,
  EMPTY_CUSTOM_CATEGORIES,
  parseCustomCategoriesWithRecovery,
  parseMonthlyBudgetsWithRecovery,
  parseTransactionsWithRecovery,
  STORAGE_KEY
} from '@/lib/ledger';
import type { LedgerApiResponse, LedgerRemoteStatus, LedgerState } from '@/lib/ledger-api';
import type { CategoryMap, MonthlyBudgetMap, Transaction } from '@/lib/types';

export type LedgerStorageMode = 'local' | 'remote';

export interface LedgerLoadResult {
  data: LedgerState;
  recoveredTransactions: boolean;
  recoveredBudgets: boolean;
  recoveredCategories: boolean;
}

export interface LedgerStorageAdapter {
  readonly mode: LedgerStorageMode;
  load(): Promise<LedgerLoadResult>;
  saveTransactions(transactions: Transaction[]): Promise<void>;
  saveMonthlyBudgets(monthlyBudgets: MonthlyBudgetMap): Promise<void>;
  saveCustomCategories(customCategories: CategoryMap): Promise<void>;
}

export interface RemoteStorageError {
  code: string;
  message: string;
  missingEnv?: string[];
}

function safeLocalStorageGetItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(key);
}

function safeLocalStorageSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, value);
}

export function loadLedgerFromLocalStorage(): LedgerLoadResult {
  const transactionsResult = parseTransactionsWithRecovery(safeLocalStorageGetItem(STORAGE_KEY));
  const budgetResult = parseMonthlyBudgetsWithRecovery(safeLocalStorageGetItem(BUDGET_STORAGE_KEY));
  const categoriesResult = parseCustomCategoriesWithRecovery(safeLocalStorageGetItem(CATEGORY_STORAGE_KEY));

  return {
    data: {
      transactions: transactionsResult.data,
      monthlyBudgets: budgetResult.data,
      customCategories: categoriesResult.data
    },
    recoveredTransactions: transactionsResult.recovered,
    recoveredBudgets: budgetResult.recovered,
    recoveredCategories: categoriesResult.recovered
  };
}

export class LocalLedgerStorageAdapter implements LedgerStorageAdapter {
  readonly mode: LedgerStorageMode = 'local';

  async load(): Promise<LedgerLoadResult> {
    return loadLedgerFromLocalStorage();
  }

  async saveTransactions(transactions: Transaction[]): Promise<void> {
    safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(transactions));
  }

  async saveMonthlyBudgets(monthlyBudgets: MonthlyBudgetMap): Promise<void> {
    safeLocalStorageSetItem(BUDGET_STORAGE_KEY, JSON.stringify(monthlyBudgets));
  }

  async saveCustomCategories(customCategories: CategoryMap): Promise<void> {
    safeLocalStorageSetItem(CATEGORY_STORAGE_KEY, JSON.stringify(customCategories));
  }
}

async function requestLedgerApi<T>(resource: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/ledger/${resource}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    cache: 'no-store'
  });

  const payload = (await response.json()) as LedgerApiResponse<T>;

  if (payload.ok) {
    return payload.data;
  }

  throw {
    code: payload.error.code,
    message: payload.error.message,
    missingEnv: payload.error.missingEnv
  } as RemoteStorageError;
}

export class RemoteLedgerStorageAdapter implements LedgerStorageAdapter {
  readonly mode: LedgerStorageMode = 'remote';

  async load(): Promise<LedgerLoadResult> {
    const [transactions, monthlyBudgets, customCategories] = await Promise.all([
      requestLedgerApi<Transaction[]>('transactions'),
      requestLedgerApi<MonthlyBudgetMap>('budgets'),
      requestLedgerApi<CategoryMap>('categories')
    ]);

    return {
      data: {
        transactions,
        monthlyBudgets,
        customCategories
      },
      recoveredTransactions: false,
      recoveredBudgets: false,
      recoveredCategories: false
    };
  }

  async saveTransactions(transactions: Transaction[]): Promise<void> {
    await requestLedgerApi<Transaction[]>('transactions', {
      method: 'PUT',
      body: JSON.stringify({ transactions })
    });
  }

  async saveMonthlyBudgets(monthlyBudgets: MonthlyBudgetMap): Promise<void> {
    await requestLedgerApi<MonthlyBudgetMap>('budgets', {
      method: 'PUT',
      body: JSON.stringify({ monthlyBudgets })
    });
  }

  async saveCustomCategories(customCategories: CategoryMap): Promise<void> {
    await requestLedgerApi<CategoryMap>('categories', {
      method: 'PUT',
      body: JSON.stringify({ customCategories })
    });
  }
}

export async function fetchRemoteLedgerStatus(): Promise<LedgerRemoteStatus> {
  return requestLedgerApi<LedgerRemoteStatus>('status');
}

export function createDefaultLedgerStorageAdapter(): LedgerStorageAdapter {
  return new LocalLedgerStorageAdapter();
}

export function createRemoteLedgerStorageAdapter(): LedgerStorageAdapter {
  return new RemoteLedgerStorageAdapter();
}

export function createEmptyLedgerState(): LedgerState {
  return {
    transactions: [],
    monthlyBudgets: {},
    customCategories: { ...EMPTY_CUSTOM_CATEGORIES }
  };
}
