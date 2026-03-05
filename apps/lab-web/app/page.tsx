'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BUDGET_STORAGE_KEY,
  CATEGORY_STORAGE_KEY,
  CATEGORY_PRESETS,
  EMPTY_CUSTOM_CATEGORIES,
  formatKRW,
  getCurrentMonthKey,
  getMonthlyBudgetProgress,
  getMonthlyCategorySummary,
  getMonthlySummary,
  getTodayDate,
  getTypeLabel,
  mergeTransactions,
  parseCustomCategoriesWithRecovery,
  parseMonthlyBudgetsWithRecovery,
  parseImportTransactions,
  parseTransactionsWithRecovery,
  shiftMonthKey,
  sortTransactions,
  STORAGE_KEY,
  validateTransactionForm
} from '@/lib/ledger';
import type { CategoryMap, MonthlyBudgetMap, Transaction, TransactionFilter, TransactionType } from '@/lib/types';

interface TransactionFormState {
  date: string;
  type: TransactionType;
  category: string;
  amount: string;
  memo: string;
}

interface FormErrors {
  date?: string;
  category?: string;
  amount?: string;
}

type NoticeTone = 'success' | 'error';
type ImportMode = 'merge' | 'replace';
type MonthlySort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

interface QuickTemplate {
  id: string;
  label: string;
  type: TransactionType;
  category: string;
  amount: number;
  memo: string;
}

interface UndoState {
  message: string;
  transactions: Transaction[];
  monthlyBudgets: MonthlyBudgetMap;
  customCategories: CategoryMap;
  selectedMonth: string;
  budgetDrafts: Record<string, string>;
  categoryDrafts: Record<TransactionType, string>;
  filter: TransactionFilter;
  formState: TransactionFormState;
  formErrors: FormErrors;
  editingId: string | null;
  searchText: string;
  sortMode: MonthlySort;
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  { id: 'salary', label: '월급', type: 'income', category: '급여', amount: 3000000, memo: '월급' },
  { id: 'rent', label: '월세', type: 'expense', category: '주거', amount: 800000, memo: '월세' },
  { id: 'phone', label: '통신비', type: 'expense', category: '통신비', amount: 70000, memo: '통신비' }
];

function createEmptyForm(type: TransactionType = 'expense'): TransactionFormState {
  return {
    date: getTodayDate(),
    type,
    category: CATEGORY_PRESETS[type][0],
    amount: '',
    memo: ''
  };
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function HomePage() {
  const [initialStorageLoad] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        transactions: [] as Transaction[],
        monthlyBudgets: {} as MonthlyBudgetMap,
        customCategories: { ...EMPTY_CUSTOM_CATEGORIES },
        recoveredTransactions: false,
        recoveredBudgets: false,
        recoveredCategories: false
      };
    }

    const transactionsResult = parseTransactionsWithRecovery(window.localStorage.getItem(STORAGE_KEY));
    const budgetResult = parseMonthlyBudgetsWithRecovery(window.localStorage.getItem(BUDGET_STORAGE_KEY));
    const categoriesResult = parseCustomCategoriesWithRecovery(window.localStorage.getItem(CATEGORY_STORAGE_KEY));

    return {
      transactions: transactionsResult.data,
      monthlyBudgets: budgetResult.data,
      customCategories: categoriesResult.data,
      recoveredTransactions: transactionsResult.recovered,
      recoveredBudgets: budgetResult.recovered,
      recoveredCategories: categoriesResult.recovered
    };
  });
  const [transactions, setTransactions] = useState<Transaction[]>(initialStorageLoad.transactions);
  const [monthlyBudgets, setMonthlyBudgets] = useState<MonthlyBudgetMap>(initialStorageLoad.monthlyBudgets);
  const [customCategories, setCustomCategories] = useState<CategoryMap>(initialStorageLoad.customCategories);
  const initialRecoveryNotice = useMemo(() => {
    if (
      !initialStorageLoad.recoveredTransactions &&
      !initialStorageLoad.recoveredBudgets &&
      !initialStorageLoad.recoveredCategories
    ) {
      return null;
    }

    const recoveredTargets = [
      initialStorageLoad.recoveredTransactions ? '거래 내역' : '',
      initialStorageLoad.recoveredBudgets ? '월별 예산' : '',
      initialStorageLoad.recoveredCategories ? '커스텀 카테고리' : ''
    ].filter(Boolean);

    return {
      tone: 'error' as NoticeTone,
      message: `손상된 저장 데이터(${recoveredTargets.join(', ')})를 복구해 유효 항목만 불러왔습니다.`
    };
  }, [
    initialStorageLoad.recoveredTransactions,
    initialStorageLoad.recoveredBudgets,
    initialStorageLoad.recoveredCategories
  ]);
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [categoryDrafts, setCategoryDrafts] = useState<Record<TransactionType, string>>({
    income: '',
    expense: ''
  });
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<TransactionFormState>(createEmptyForm('expense'));
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(initialRecoveryNotice);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [searchText, setSearchText] = useState<string>('');
  const [sortMode, setSortMode] = useState<MonthlySort>('date_desc');
  const [undoState, setUndoState] = useState<UndoState | null>(null);

  const thisMonthKey = getCurrentMonthKey();

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    window.localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(monthlyBudgets));
  }, [monthlyBudgets]);

  useEffect(() => {
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(customCategories));
  }, [customCategories]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!undoState) {
      return;
    }

    const timer = window.setTimeout(() => setUndoState(null), 7000);
    return () => window.clearTimeout(timer);
  }, [undoState]);

  useEffect(() => {
    if (!editingId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      setFormState(createEmptyForm(formState.type));
      setFormErrors({});
      setEditingId(null);
      setNotice({ tone: 'success', message: '수정 모드를 취소했습니다.' });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingId, formState.type]);

  const categoryOptionsByType = useMemo(
    () => ({
      income: [...CATEGORY_PRESETS.income, ...customCategories.income],
      expense: [...CATEGORY_PRESETS.expense, ...customCategories.expense]
    }),
    [customCategories]
  );

  const thisMonthSummary = useMemo(
    () => getMonthlySummary(transactions, thisMonthKey),
    [transactions, thisMonthKey]
  );
  const selectedMonthSummary = useMemo(
    () => getMonthlySummary(transactions, selectedMonth),
    [transactions, selectedMonth]
  );
  const selectedMonthBudget = monthlyBudgets[selectedMonth] ?? 0;
  const budgetInput = budgetDrafts[selectedMonth] ?? (selectedMonthBudget > 0 ? String(selectedMonthBudget) : '');
  const budgetProgress = useMemo(
    () => getMonthlyBudgetProgress(selectedMonthSummary, selectedMonthBudget),
    [selectedMonthSummary, selectedMonthBudget]
  );

  const monthlyTransactions = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    const filtered = transactions
      .filter((item) => item.date.slice(0, 7) === selectedMonth)
      .filter((item) => (filter === 'all' ? true : item.type === filter))
      .filter((item) => {
        if (!normalizedSearch) {
          return true;
        }

        const memo = item.memo.toLowerCase();
        const category = item.category.toLowerCase();
        return memo.includes(normalizedSearch) || category.includes(normalizedSearch);
      });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'date_desc') {
        return sortTransactions(a, b);
      }

      if (sortMode === 'date_asc') {
        return sortTransactions(b, a);
      }

      if (sortMode === 'amount_desc') {
        if (b.amount === a.amount) {
          return sortTransactions(a, b);
        }
        return b.amount - a.amount;
      }

      if (a.amount === b.amount) {
        return sortTransactions(a, b);
      }
      return a.amount - b.amount;
    });
  }, [transactions, selectedMonth, filter, searchText, sortMode]);

  const monthlyIncomeByCategory = useMemo(
    () => getMonthlyCategorySummary(transactions, selectedMonth, 'income'),
    [transactions, selectedMonth]
  );

  const monthlyExpenseByCategory = useMemo(
    () => getMonthlyCategorySummary(transactions, selectedMonth, 'expense'),
    [transactions, selectedMonth]
  );
  const monthlyQuickStats = useMemo(() => {
    const expenseTransactions = monthlyTransactions.filter((item) => item.type === 'expense');
    const totalExpense = expenseTransactions.reduce((sum, item) => sum + item.amount, 0);
    const avgExpense = expenseTransactions.length > 0 ? Math.round(totalExpense / expenseTransactions.length) : 0;
    const categoryTotals = expenseTransactions.reduce<Map<string, number>>((acc, item) => {
      acc.set(item.category, (acc.get(item.category) ?? 0) + item.amount);
      return acc;
    }, new Map());

    const topExpenseCategory = Array.from(categoryTotals.entries()).sort((a, b) => {
      if (b[1] === a[1]) {
        return a[0].localeCompare(b[0]);
      }
      return b[1] - a[1];
    })[0];

    return {
      transactionCount: monthlyTransactions.length,
      avgExpense,
      expenseCount: expenseTransactions.length,
      topExpenseCategory: topExpenseCategory
        ? `${topExpenseCategory[0]} (${formatKRW(topExpenseCategory[1])})`
        : '없음'
    };
  }, [monthlyTransactions]);

  const resetForm = (type: TransactionType = 'expense') => {
    setFormState(() => ({
      ...createEmptyForm(type),
      category: categoryOptionsByType[type][0]
    }));
    setFormErrors({});
    setEditingId(null);
  };

  const captureUndoState = (message: string): UndoState => ({
    message,
    transactions: transactions.map((item) => ({ ...item })),
    monthlyBudgets: { ...monthlyBudgets },
    customCategories: {
      income: [...customCategories.income],
      expense: [...customCategories.expense]
    },
    selectedMonth,
    budgetDrafts: { ...budgetDrafts },
    categoryDrafts: { ...categoryDrafts },
    filter,
    formState: { ...formState },
    formErrors: { ...formErrors },
    editingId,
    searchText,
    sortMode
  });

  const restoreUndoState = () => {
    if (!undoState) {
      return;
    }

    setTransactions(undoState.transactions);
    setMonthlyBudgets(undoState.monthlyBudgets);
    setCustomCategories(undoState.customCategories);
    setSelectedMonth(undoState.selectedMonth);
    setBudgetDrafts(undoState.budgetDrafts);
    setCategoryDrafts(undoState.categoryDrafts);
    setFilter(undoState.filter);
    setFormState(undoState.formState);
    setFormErrors(undoState.formErrors);
    setEditingId(undoState.editingId);
    setSearchText(undoState.searchText);
    setSortMode(undoState.sortMode);
    setUndoState(null);
    setNotice({ tone: 'success', message: '직전 작업을 되돌렸습니다.' });
  };

  const handleTypeChange = (nextType: TransactionType) => {
    const nextCategories = categoryOptionsByType[nextType];

    setFormState((prev) => ({
      ...prev,
      type: nextType,
      category: nextCategories.includes(prev.category) ? prev.category : nextCategories[0]
    }));

    setFormErrors((prev) => ({ ...prev, category: undefined }));
  };

  const addCustomCategory = (type: TransactionType) => {
    const candidate = categoryDrafts[type].trim();
    if (!candidate) {
      setNotice({ tone: 'error', message: `${getTypeLabel(type)} 카테고리 이름을 입력하세요.` });
      return;
    }

    if (CATEGORY_PRESETS[type].includes(candidate) || customCategories[type].includes(candidate)) {
      setNotice({ tone: 'error', message: '이미 등록된 카테고리입니다.' });
      return;
    }

    setCustomCategories((prev) => ({ ...prev, [type]: [...prev[type], candidate] }));
    setCategoryDrafts((prev) => ({ ...prev, [type]: '' }));
    setNotice({ tone: 'success', message: `${getTypeLabel(type)} 카테고리 "${candidate}"를 추가했습니다.` });
  };

  const removeCustomCategory = (type: TransactionType, category: string) => {
    const isUsed = transactions.some((item) => item.type === type && item.category === category);
    if (isUsed) {
      setNotice({ tone: 'error', message: `사용 중인 카테고리("${category}")는 삭제할 수 없습니다.` });
      return;
    }

    setCustomCategories((prev) => ({
      ...prev,
      [type]: prev[type].filter((item) => item !== category)
    }));
    if (formState.type === type && formState.category === category) {
      setFormState((prev) => ({ ...prev, category: CATEGORY_PRESETS[type][0] }));
      setFormErrors((prev) => ({ ...prev, category: undefined }));
    }
    setNotice({ tone: 'success', message: `카테고리 "${category}"를 삭제했습니다.` });
  };

  const resetCategoryPresets = () => {
    if (customCategories.income.length === 0 && customCategories.expense.length === 0) {
      setNotice({ tone: 'success', message: '이미 기본 카테고리 프리셋 상태입니다.' });
      return;
    }

    setCustomCategories({ ...EMPTY_CUSTOM_CATEGORIES });
    setCategoryDrafts({ income: '', expense: '' });
    if (!CATEGORY_PRESETS[formState.type].includes(formState.category)) {
      setFormState((prev) => ({ ...prev, category: CATEGORY_PRESETS[prev.type][0] }));
      setFormErrors((prev) => ({ ...prev, category: undefined }));
    }
    setNotice({ tone: 'success', message: '카테고리를 기본 프리셋으로 되돌렸습니다.' });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const amount = Number(formState.amount);
    const errors = validateTransactionForm({
      date: formState.date,
      category: formState.category,
      amount
    });

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      setNotice({ tone: 'error', message: '입력값을 확인해 주세요.' });
      return;
    }

    const now = new Date().toISOString();

    if (editingId) {
      setTransactions((prev) =>
        prev
          .map((item) =>
            item.id === editingId
              ? {
                  ...item,
                  date: formState.date,
                  type: formState.type,
                  category: formState.category,
                  amount,
                  memo: formState.memo.trim(),
                  updatedAt: now
                }
              : item
          )
          .sort(sortTransactions)
      );
      setNotice({ tone: 'success', message: '내역을 수정했습니다.' });
      resetForm(formState.type);
      return;
    }

    const newTransaction: Transaction = {
      id: createId(),
      date: formState.date,
      type: formState.type,
      category: formState.category,
      amount,
      memo: formState.memo.trim(),
      createdAt: now,
      updatedAt: now
    };

    setTransactions((prev) => [newTransaction, ...prev].sort(sortTransactions));
    setNotice({ tone: 'success', message: '내역을 저장했습니다.' });
    resetForm(formState.type);
  };

  const startEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setFormErrors({});
    setFormState({
      date: transaction.date,
      type: transaction.type,
      category: transaction.category,
      amount: String(transaction.amount),
      memo: transaction.memo
    });
  };

  const removeTransaction = (id: string) => {
    if (!window.confirm('이 내역을 삭제할까요?')) {
      return;
    }

    setUndoState(captureUndoState('내역을 삭제했습니다. 7초 안에 되돌릴 수 있습니다.'));
    setTransactions((prev) => prev.filter((item) => item.id !== id));
    setNotice({ tone: 'success', message: '내역을 삭제했습니다.' });
    if (editingId === id) {
      resetForm();
    }
  };

  const applyQuickTemplate = (template: QuickTemplate) => {
    const now = new Date().toISOString();
    const newTransaction: Transaction = {
      id: createId(),
      date: getTodayDate(),
      type: template.type,
      category: template.category,
      amount: template.amount,
      memo: template.memo,
      createdAt: now,
      updatedAt: now
    };

    setTransactions((prev) => [newTransaction, ...prev].sort(sortTransactions));
    setNotice({ tone: 'success', message: `${template.label} 템플릿을 오늘 내역으로 추가했습니다.` });
  };

  const duplicateTransaction = (transaction: Transaction) => {
    const now = new Date().toISOString();
    const duplicated: Transaction = {
      ...transaction,
      id: createId(),
      createdAt: now,
      updatedAt: now
    };

    setTransactions((prev) => [duplicated, ...prev].sort(sortTransactions));
    setNotice({ tone: 'success', message: '내역을 복제했습니다.' });
  };

  const saveMonthlyBudget = () => {
    const parsed = Number(budgetInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setNotice({ tone: 'error', message: '예산은 1원 이상의 숫자로 입력하세요.' });
      return;
    }

    const normalized = Math.floor(parsed);
    setMonthlyBudgets((prev) => ({ ...prev, [selectedMonth]: normalized }));
    setBudgetDrafts((prev) => ({ ...prev, [selectedMonth]: String(normalized) }));
    setNotice({ tone: 'success', message: `${selectedMonth} 예산을 저장했습니다.` });
  };

  const clearMonthlyBudget = () => {
    if (!(selectedMonth in monthlyBudgets)) {
      return;
    }

    setUndoState(captureUndoState(`${selectedMonth} 예산 삭제를 7초 안에 되돌릴 수 있습니다.`));
    setMonthlyBudgets((prev) => {
      const next = { ...prev };
      delete next[selectedMonth];
      return next;
    });
    setBudgetDrafts((prev) => {
      const next = { ...prev };
      delete next[selectedMonth];
      return next;
    });
    setNotice({ tone: 'success', message: `${selectedMonth} 예산을 삭제했습니다.` });
  };

  const exportTransactions = () => {
    const payload = JSON.stringify(transactions, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);

    anchor.href = url;
    anchor.download = `ledger-transactions-${stamp}.json`;
    anchor.click();

    URL.revokeObjectURL(url);
    setNotice({ tone: 'success', message: 'JSON 내보내기를 완료했습니다.' });
  };

  const exportMonthlyCsv = () => {
    if (monthlyTransactions.length === 0) {
      setNotice({ tone: 'error', message: 'CSV로 내보낼 월별 내역이 없습니다.' });
      return;
    }

    const escapeCsvField = (value: string | number) => {
      const normalized = String(value).replaceAll('"', '""');
      return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
    };

    const rows = [
      ['날짜', '구분', '카테고리', '금액', '메모'],
      ...monthlyTransactions.map((item) => [
        item.date,
        getTypeLabel(item.type),
        item.category,
        String(item.amount),
        item.memo
      ])
    ];

    const payload = `\uFEFF${rows.map((row) => row.map(escapeCsvField).join(',')).join('\n')}`;
    const blob = new Blob([payload], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);

    anchor.href = url;
    anchor.download = `ledger-monthly-${selectedMonth}-${stamp}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
    setNotice({ tone: 'success', message: `${selectedMonth} 현재 목록 CSV 내보내기를 완료했습니다.` });
  };

  const importTransactions = async () => {
    if (!importFile) {
      setNotice({ tone: 'error', message: '가져올 JSON 파일을 선택하세요.' });
      return;
    }

    const raw = await importFile.text();
    const { items, invalidCount } = parseImportTransactions(raw);

    if (items.length === 0) {
      setNotice({ tone: 'error', message: '유효한 거래 데이터가 없습니다.' });
      return;
    }

    setTransactions((prev) =>
      importMode === 'merge' ? mergeTransactions(prev, items) : [...items].sort(sortTransactions)
    );

    setImportFile(null);
    setNotice({
      tone: 'success',
      message:
        importMode === 'merge'
          ? `가져오기 완료: ${items.length}건 반영${invalidCount ? `, 무시 ${invalidCount}건` : ''}`
          : `가져오기 완료: ${items.length}건으로 교체${invalidCount ? `, 무시 ${invalidCount}건` : ''}`
    });
  };

  const resetAllData = () => {
    if (!window.confirm('저장된 모든 거래 데이터를 초기화할까요? 7초 동안 실행 취소할 수 있습니다.')) {
      return;
    }

    setUndoState(captureUndoState('전체 초기화를 실행했습니다. 7초 안에 되돌릴 수 있습니다.'));
    setTransactions([]);
    setMonthlyBudgets({});
    setCustomCategories({ ...EMPTY_CUSTOM_CATEGORIES });
    setSelectedMonth(getCurrentMonthKey());
    setBudgetDrafts({});
    setCategoryDrafts({ income: '', expense: '' });
    setFilter('all');
    resetForm('expense');
    setNotice({ tone: 'success', message: '모든 데이터를 초기화했습니다.' });
  };

  const categoryOptions = useMemo(() => {
    const baseOptions = [...categoryOptionsByType[formState.type]];
    if (formState.category && !baseOptions.includes(formState.category)) {
      baseOptions.push(formState.category);
    }
    return baseOptions;
  }, [categoryOptionsByType, formState.type, formState.category]);

  return (
    <main className="ledger-page">
      <section className="header-block">
        <p className="eyebrow">HOUSEHOLD LEDGER MVP</p>
        <h1>주말 배포용 가계부</h1>
        <p className="subcopy">수입/지출을 빠르게 기록하고 월별 흐름을 바로 확인하세요.</p>
      </section>

      <div className="status-area" role="status" aria-live="polite">
        {notice ? <p className={`toast ${notice.tone}`}>{notice.message}</p> : null}
        {undoState ? (
          <div className="undo-bar">
            <p>{undoState.message}</p>
            <button type="button" className="ghost undo-button" onClick={restoreUndoState}>
              실행 취소
            </button>
          </div>
        ) : null}
      </div>

      <section className="summary-grid" aria-label="이번 달 요약">
        <article className="summary-card income">
          <p>이번 달 수입</p>
          <strong>{formatKRW(thisMonthSummary.income)}</strong>
        </article>
        <article className="summary-card expense">
          <p>이번 달 지출</p>
          <strong>{formatKRW(thisMonthSummary.expense)}</strong>
        </article>
        <article className="summary-card balance">
          <p>이번 달 잔액</p>
          <strong>{formatKRW(thisMonthSummary.balance)}</strong>
        </article>
      </section>

      <section className="panel" aria-label="월별 예산">
        <h2>월별 예산 ({selectedMonth})</h2>
        <div className="budget-grid">
          <label htmlFor="budget-input">
            예산 입력
            <input
              id="budget-input"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={budgetInput}
              onChange={(event) =>
                setBudgetDrafts((prev) => ({ ...prev, [selectedMonth]: event.target.value }))
              }
              placeholder="예: 1200000"
            />
          </label>
          <div className="button-row budget-actions">
            <button type="button" onClick={saveMonthlyBudget}>
              예산 저장
            </button>
            <button type="button" className="ghost" onClick={clearMonthlyBudget}>
              예산 삭제
            </button>
          </div>
        </div>

        <div className="budget-summary">
          <p>
            <span>지출 / 예산</span>
            <strong>
              {formatKRW(budgetProgress.spent)} /{' '}
              {budgetProgress.budget > 0 ? formatKRW(budgetProgress.budget) : '미설정'}
            </strong>
          </p>
          <p className={budgetProgress.isOverBudget ? 'budget-warning' : ''}>
            {budgetProgress.budget === 0
              ? '이번 달 예산을 설정하면 진행률을 볼 수 있습니다.'
              : budgetProgress.isOverBudget
                ? `예산 초과 ${formatKRW(Math.abs(budgetProgress.remaining))}`
                : `남은 예산 ${formatKRW(budgetProgress.remaining)}`}
          </p>
          <div className="budget-progress-track" aria-hidden="true">
            <div className="budget-progress-fill" style={{ width: `${budgetProgress.progressRate}%` }} />
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>데이터 관리</h2>
        <div className="data-tools">
          <button type="button" onClick={exportTransactions}>
            JSON 내보내기
          </button>

          <label htmlFor="import-json-file" className="file-picker">
            JSON 가져오기
            <input
              id="import-json-file"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setImportFile(file);
              }}
            />
          </label>

          <label htmlFor="import-mode">
            가져오기 방식
            <select
              id="import-mode"
              value={importMode}
              onChange={(event) => setImportMode(event.target.value as ImportMode)}
            >
              <option value="merge">기존 데이터와 병합</option>
              <option value="replace">기존 데이터 교체</option>
            </select>
          </label>

          <button type="button" className="ghost" onClick={importTransactions}>
            가져오기 실행
          </button>

          <button type="button" className="danger" onClick={resetAllData}>
            전체 초기화
          </button>
        </div>
        <p className="hint">
          병합은 ID 기준으로 합치며, 동일 ID 충돌 시 최신 수정 시각 데이터를 유지합니다.
        </p>
      </section>

      <section className="panel">
        <div className="category-header">
          <h2>카테고리 관리</h2>
          <button type="button" className="ghost" onClick={resetCategoryPresets}>
            기본 프리셋 복원
          </button>
        </div>
        <p className="hint">커스텀 카테고리만 추가/삭제할 수 있습니다. 기본 프리셋은 고정됩니다.</p>
        <div className="category-manage-grid">
          {(['income', 'expense'] as const).map((type) => (
            <article key={type} className="category-manage-card">
              <h3>{getTypeLabel(type)} 카테고리</h3>
              <div className="category-input-row">
                <input
                  type="text"
                  maxLength={20}
                  value={categoryDrafts[type]}
                  onChange={(event) =>
                    setCategoryDrafts((prev) => ({
                      ...prev,
                      [type]: event.target.value
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
                      return;
                    }

                    event.preventDefault();
                    addCustomCategory(type);
                  }}
                  placeholder={`${getTypeLabel(type)} 커스텀 카테고리`}
                />
                <button type="button" onClick={() => addCustomCategory(type)}>
                  추가
                </button>
              </div>
              {customCategories[type].length === 0 ? (
                <p className="empty category-empty">등록된 커스텀 카테고리가 없습니다.</p>
              ) : (
                <ul className="category-chip-list">
                  {customCategories[type].map((category) => (
                    <li key={`${type}-${category}`} className="category-chip">
                      <span>{category}</span>
                      <button type="button" className="danger" onClick={() => removeCustomCategory(type, category)}>
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>{editingId ? '내역 수정' : '내역 추가'}</h2>
        <div className="template-block">
          <p className="hint">반복 지출/수입은 템플릿으로 오늘 날짜에 1클릭 추가할 수 있습니다.</p>
          <div className="template-grid">
            {QUICK_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className="ghost template-button"
                aria-label={`${template.label} 템플릿 추가`}
                onClick={() => applyQuickTemplate(template)}
              >
                {template.label} {formatKRW(template.amount)}
              </button>
            ))}
          </div>
        </div>
        <form className="tx-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="tx-date">
            날짜
            <input
              id="tx-date"
              type="date"
              value={formState.date}
              onChange={(event) => {
                const date = event.target.value;
                setFormState((prev) => ({ ...prev, date }));
                setFormErrors((prev) => ({
                  ...prev,
                  date: validateTransactionForm({
                    date,
                    category: formState.category,
                    amount: Number(formState.amount)
                  }).date
                }));
              }}
              required
            />
            {formErrors.date ? <span className="field-error">{formErrors.date}</span> : null}
          </label>

          <label htmlFor="tx-type">
            구분
            <select
              id="tx-type"
              value={formState.type}
              onChange={(event) => handleTypeChange(event.target.value as TransactionType)}
            >
              <option value="income">수입</option>
              <option value="expense">지출</option>
            </select>
          </label>

          <label htmlFor="tx-category">
            카테고리
            <select
              id="tx-category"
              value={formState.category}
              onChange={(event) => {
                const category = event.target.value;
                setFormState((prev) => ({ ...prev, category }));
                setFormErrors((prev) => ({
                  ...prev,
                  category: validateTransactionForm({
                    date: formState.date,
                    category,
                    amount: Number(formState.amount)
                  }).category
                }));
              }}
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {formErrors.category ? <span className="field-error">{formErrors.category}</span> : null}
          </label>

          <label htmlFor="tx-amount">
            금액
            <input
              id="tx-amount"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={formState.amount}
              onChange={(event) => {
                const amount = event.target.value;
                setFormState((prev) => ({ ...prev, amount }));
                setFormErrors((prev) => ({
                  ...prev,
                  amount: validateTransactionForm({
                    date: formState.date,
                    category: formState.category,
                    amount: Number(amount)
                  }).amount
                }));
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
                  return;
                }

                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }}
              placeholder="예: 15000"
              required
            />
            {formErrors.amount ? <span className="field-error">{formErrors.amount}</span> : null}
          </label>

          <label htmlFor="tx-memo" className="memo-row">
            메모
            <input
              id="tx-memo"
              type="text"
              maxLength={80}
              value={formState.memo}
              onChange={(event) => setFormState((prev) => ({ ...prev, memo: event.target.value }))}
              placeholder="선택 입력"
            />
          </label>

          <div className="button-row">
            <button type="submit">{editingId ? '수정 저장' : '내역 저장'}</button>
            {editingId ? (
              <button type="button" className="ghost" onClick={() => resetForm(formState.type)}>
                취소
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="list-topbar">
          <h2>월별 내역</h2>
          <div className="list-controls">
            <label htmlFor="month-select">
              월 선택
              <input
                id="month-select"
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            </label>
            <div className="month-nav" aria-label="월 빠른 이동">
              <button type="button" className="ghost" onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, -1))}>
                이전 달
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setSelectedMonth(thisMonthKey)}
                disabled={selectedMonth === thisMonthKey}
              >
                이번 달
              </button>
              <button type="button" className="ghost" onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, 1))}>
                다음 달
              </button>
            </div>
            <label htmlFor="month-search">
              검색
              <input
                id="month-search"
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="카테고리/메모 포함 검색"
              />
            </label>
            <label htmlFor="month-sort">
              정렬
              <select id="month-sort" value={sortMode} onChange={(event) => setSortMode(event.target.value as MonthlySort)}>
                <option value="date_desc">날짜 최신순</option>
                <option value="date_asc">날짜 오래된순</option>
                <option value="amount_desc">금액 큰순</option>
                <option value="amount_asc">금액 작은순</option>
              </select>
            </label>
          </div>
        </div>

        <div className="filter-tabs" role="tablist" aria-label="수입 지출 필터">
          {([
            { key: 'all', label: '전체' },
            { key: 'income', label: '수입' },
            { key: 'expense', label: '지출' }
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              className={filter === item.key ? 'active' : ''}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="monthly-meta-row">
          <div className="quick-stats" aria-label="월별 빠른 통계">
            <p className="stat-chip">
              <span>거래 건수</span>
              <strong>{monthlyQuickStats.transactionCount}건</strong>
            </p>
            <p className="stat-chip">
              <span>지출 평균</span>
              <strong>
                {monthlyQuickStats.expenseCount > 0 ? formatKRW(monthlyQuickStats.avgExpense) : '없음'}
              </strong>
            </p>
            <p className="stat-chip">
              <span>최다 지출 카테고리</span>
              <strong>{monthlyQuickStats.topExpenseCategory}</strong>
            </p>
          </div>
          <button type="button" className="ghost" onClick={exportMonthlyCsv}>
            현재 목록 CSV
          </button>
        </div>

        <ul className="tx-list">
          {monthlyTransactions.length === 0 ? (
            transactions.length === 0 ? (
              <li className="empty onboarding">
                <strong>처음이시라면 이렇게 시작해 보세요.</strong>
                <p>1) 위 템플릿 버튼으로 월급/월세/통신비를 먼저 등록하세요.</p>
                <p>2) 내역 추가 폼에서 자주 쓰는 지출을 직접 입력하세요.</p>
                <p>3) 월별 내역 검색으로 원하는 항목을 빠르게 찾을 수 있습니다.</p>
              </li>
            ) : (
              <li className="empty">조건에 맞는 내역이 없습니다.</li>
            )
          ) : (
            monthlyTransactions.map((item) => (
              <li key={item.id} className="tx-item">
                <div className="tx-main">
                  <p className="tx-meta">
                    <span>{item.date}</span>
                    <span>{getTypeLabel(item.type)}</span>
                    <span>{item.category}</span>
                  </p>
                  <p className={`tx-amount ${item.type}`}>
                    {item.type === 'income' ? '+' : '-'}
                    {formatKRW(item.amount)}
                  </p>
                  {item.memo ? <p className="tx-memo">{item.memo}</p> : null}
                </div>
                <div className="tx-actions">
                  <button
                    type="button"
                    className="ghost"
                    aria-label={`${item.date} ${item.category} 내역 수정`}
                    onClick={() => startEdit(item)}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    aria-label={`${item.date} ${item.category} 내역 복제`}
                    onClick={() => duplicateTransaction(item)}
                  >
                    복제
                  </button>
                  <button
                    type="button"
                    className="danger"
                    aria-label={`${item.date} ${item.category} 내역 삭제`}
                    onClick={() => removeTransaction(item.id)}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="panel">
        <h2>월별 카테고리 요약 ({selectedMonth})</h2>
        <div className="category-summary-grid">
          <article>
            <h3>수입 카테고리</h3>
            {monthlyIncomeByCategory.length === 0 ? (
              <p className="empty">수입 데이터가 없습니다.</p>
            ) : (
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>카테고리</th>
                    <th>합계</th>
                    <th>비율</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyIncomeByCategory.map((row) => (
                    <tr key={`income-${row.category}`}>
                      <td>{row.category}</td>
                      <td>{formatKRW(row.total)}</td>
                      <td>{row.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          <article>
            <h3>지출 카테고리</h3>
            {monthlyExpenseByCategory.length === 0 ? (
              <p className="empty">지출 데이터가 없습니다.</p>
            ) : (
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>카테고리</th>
                    <th>합계</th>
                    <th>비율</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyExpenseByCategory.map((row) => (
                    <tr key={`expense-${row.category}`}>
                      <td>{row.category}</td>
                      <td>{formatKRW(row.total)}</td>
                      <td>{row.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
