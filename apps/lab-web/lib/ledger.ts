import type { MonthlySummary, Transaction, TransactionType } from '@/lib/types';

export const STORAGE_KEY = 'lab-web-household-ledger-v1';

export const CATEGORY_PRESETS: Record<TransactionType, string[]> = {
  income: ['급여', '부수입', '이자', '환급', '용돈', '기타수입'],
  expense: ['식비', '교통', '주거', '쇼핑', '의료', '문화', '교육', '기타지출']
};

export const EMPTY_SUMMARY: MonthlySummary = {
  income: 0,
  expense: 0,
  balance: 0
};

export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseTransactions(raw: string | null): Transaction[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidTransaction).sort(sortTransactions);
  } catch {
    return [];
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
