import type {
  CategoryMap,
  MonthlyBudgetMap,
  MonthlyBudgetProgress,
  MonthlySummary,
  Transaction,
  TransactionType
} from '@/lib/types';

export const STORAGE_KEY = 'lab-web-household-ledger-v1';
export const BUDGET_STORAGE_KEY = 'lab-web-household-ledger-budget-v1';
export const CATEGORY_STORAGE_KEY = 'lab-web-household-ledger-category-v1';

export const CATEGORY_PRESETS: Record<TransactionType, string[]> = {
  income: ['급여', '부수입', '이자', '환급', '용돈', '기타수입'],
  expense: ['식비', '교통', '주거', '통신비', '쇼핑', '의료', '문화', '교육', '기타지출']
};

export const EMPTY_SUMMARY: MonthlySummary = {
  income: 0,
  expense: 0,
  balance: 0
};

export const EMPTY_CUSTOM_CATEGORIES: CategoryMap = {
  income: [],
  expense: []
};

export interface ParseResult<T> {
  data: T;
  recovered: boolean;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shiftMonthKey(monthKey: string, offset: number): string {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return getCurrentMonthKey();
  }

  const shifted = new Date(year, month - 1 + offset, 1);
  const nextYear = shifted.getFullYear();
  const nextMonth = String(shifted.getMonth() + 1).padStart(2, '0');

  return `${nextYear}-${nextMonth}`;
}

export function parseTransactions(raw: string | null): Transaction[] {
  return parseTransactionsWithRecovery(raw).data;
}

export function parseTransactionsWithRecovery(raw: string | null): ParseResult<Transaction[]> {
  if (!raw) {
    return { data: [], recovered: false };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { data: [], recovered: true };
    }

    const validItems = parsed.filter(isValidTransaction).sort(sortTransactions);
    return {
      data: validItems,
      recovered: validItems.length !== parsed.length
    };
  } catch {
    return { data: [], recovered: true };
  }
}

export function parseMonthlyBudgets(raw: string | null): MonthlyBudgetMap {
  return parseMonthlyBudgetsWithRecovery(raw).data;
}

export function parseMonthlyBudgetsWithRecovery(raw: string | null): ParseResult<MonthlyBudgetMap> {
  if (!raw) {
    return { data: {}, recovered: false };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { data: {}, recovered: true };
    }

    const validEntries = Object.entries(parsed).reduce<MonthlyBudgetMap>((acc, [monthKey, value]) => {
      if (/^\d{4}-\d{2}$/.test(monthKey) && typeof value === 'number' && Number.isFinite(value) && value > 0) {
        acc[monthKey] = Math.floor(value);
      }
      return acc;
    }, {});
    const recovered = Object.keys(validEntries).length !== Object.keys(parsed).length;
    return { data: validEntries, recovered };
  } catch {
    return { data: {}, recovered: true };
  }
}

export function parseCustomCategories(raw: string | null): CategoryMap {
  return parseCustomCategoriesWithRecovery(raw).data;
}

export function parseCustomCategoriesWithRecovery(raw: string | null): ParseResult<CategoryMap> {
  if (!raw) {
    return { data: EMPTY_CUSTOM_CATEGORIES, recovered: false };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { data: EMPTY_CUSTOM_CATEGORIES, recovered: true };
    }

    let recovered = false;
    const data: CategoryMap = {
      income: [],
      expense: []
    };

    for (const type of ['income', 'expense'] as const) {
      const rawItems = (parsed as Partial<CategoryMap>)[type];
      if (!Array.isArray(rawItems)) {
        recovered = true;
        continue;
      }

      const uniqueItems = new Set<string>();
      for (const item of rawItems) {
        if (typeof item !== 'string') {
          recovered = true;
          continue;
        }

        const normalized = item.trim();
        if (!normalized) {
          recovered = true;
          continue;
        }

        if (CATEGORY_PRESETS[type].includes(normalized) || uniqueItems.has(normalized)) {
          recovered = true;
          continue;
        }

        uniqueItems.add(normalized);
      }

      data[type] = Array.from(uniqueItems);
    }

    return { data, recovered };
  } catch {
    return { data: EMPTY_CUSTOM_CATEGORIES, recovered: true };
  }
}

export function isInMonth(date: string, monthKey: string): boolean {
  return date.slice(0, 7) === monthKey;
}

export function getMonthlySummary(transactions: Transaction[], monthKey: string): MonthlySummary {
  return transactions.reduce<MonthlySummary>((acc, transaction) => {
    if (!isInMonth(transaction.date, monthKey)) {
      return acc;
    }

    if (transaction.type === 'income') {
      acc.income += transaction.amount;
      acc.balance += transaction.amount;
    } else {
      acc.expense += transaction.amount;
      acc.balance -= transaction.amount;
    }

    return acc;
  }, { ...EMPTY_SUMMARY });
}

export function getMonthlyBudgetProgress(summary: MonthlySummary, budget: number): MonthlyBudgetProgress {
  const safeBudget = Math.max(0, Math.floor(budget));
  const spent = summary.expense;
  const remaining = safeBudget - spent;
  const progressRate = safeBudget > 0 ? Math.min(100, (spent / safeBudget) * 100) : 0;

  return {
    budget: safeBudget,
    spent,
    remaining,
    isOverBudget: safeBudget > 0 && spent > safeBudget,
    progressRate
  };
}

export function formatKRW(value: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}

export function getTypeLabel(type: TransactionType): string {
  return type === 'income' ? '수입' : '지출';
}

export function sortTransactions(a: Transaction, b: Transaction): number {
  if (a.date === b.date) {
    return b.updatedAt.localeCompare(a.updatedAt);
  }

  return b.date.localeCompare(a.date);
}

export interface CategorySummaryRow {
  category: string;
  total: number;
  percentage: number;
}

export function validateTransactionForm(
  transaction: Pick<Transaction, 'date' | 'category' | 'amount'>
): {
  date?: string;
  category?: string;
  amount?: string;
} {
  const errors: {
    date?: string;
    category?: string;
    amount?: string;
  } = {};

  if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) {
    errors.date = '날짜를 올바르게 입력하세요.';
  }

  if (!transaction.category.trim()) {
    errors.category = '카테고리를 선택하세요.';
  }

  if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) {
    errors.amount = '금액은 1원 이상의 숫자여야 합니다.';
  }

  return errors;
}

export function getMonthlyCategorySummary(
  transactions: Transaction[],
  monthKey: string,
  type: TransactionType
): CategorySummaryRow[] {
  const categoryTotals = transactions.reduce<Map<string, number>>((acc, item) => {
    if (item.type !== type || !isInMonth(item.date, monthKey)) {
      return acc;
    }

    acc.set(item.category, (acc.get(item.category) ?? 0) + item.amount);
    return acc;
  }, new Map());

  const grandTotal = Array.from(categoryTotals.values()).reduce((sum, current) => sum + current, 0);

  return Array.from(categoryTotals.entries())
    .map(([category, total]) => ({
      category,
      total,
      percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0
    }))
    .sort((a, b) => b.total - a.total);
}

export function mergeTransactions(existing: Transaction[], incoming: Transaction[]): Transaction[] {
  const merged = new Map<string, Transaction>();

  for (const item of existing) {
    merged.set(item.id, item);
  }

  for (const item of incoming) {
    const current = merged.get(item.id);
    if (!current || current.updatedAt <= item.updatedAt) {
      merged.set(item.id, item);
    }
  }

  return Array.from(merged.values()).sort(sortTransactions);
}

export function parseImportTransactions(raw: string): {
  items: Transaction[];
  invalidCount: number;
} {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { items: [], invalidCount: 1 };
  }

  if (!Array.isArray(parsed)) {
    return { items: [], invalidCount: 1 };
  }

  const items = parsed.filter(isValidTransaction).sort(sortTransactions);
  const invalidCount = parsed.length - items.length;
  return { items, invalidCount };
}

function isValidTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<Transaction>;

  return (
    typeof item.id === 'string' &&
    typeof item.date === 'string' &&
    (item.type === 'income' || item.type === 'expense') &&
    typeof item.category === 'string' &&
    typeof item.amount === 'number' &&
    Number.isFinite(item.amount) &&
    item.amount > 0 &&
    typeof item.memo === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string'
  );
}
