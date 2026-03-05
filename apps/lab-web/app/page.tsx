'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CATEGORY_PRESETS,
  formatKRW,
  getCurrentMonthKey,
  getMonthlyCategorySummary,
  getMonthlySummary,
  getTodayDate,
  getTypeLabel,
  mergeTransactions,
  parseImportTransactions,
  parseTransactions,
  sortTransactions,
  STORAGE_KEY,
  validateTransactionForm
} from '@/lib/ledger';
import type { Transaction, TransactionFilter, TransactionType } from '@/lib/types';

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
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    return parseTransactions(window.localStorage.getItem(STORAGE_KEY));
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<TransactionFormState>(createEmptyForm('expense'));
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');

  const thisMonthKey = getCurrentMonthKey();

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const thisMonthSummary = useMemo(
    () => getMonthlySummary(transactions, thisMonthKey),
    [transactions, thisMonthKey]
  );

  const monthlyTransactions = useMemo(() => {
    return transactions
      .filter((item) => item.date.slice(0, 7) === selectedMonth)
      .filter((item) => (filter === 'all' ? true : item.type === filter));
  }, [transactions, selectedMonth, filter]);

  const monthlyIncomeByCategory = useMemo(
    () => getMonthlyCategorySummary(transactions, selectedMonth, 'income'),
    [transactions, selectedMonth]
  );

  const monthlyExpenseByCategory = useMemo(
    () => getMonthlyCategorySummary(transactions, selectedMonth, 'expense'),
    [transactions, selectedMonth]
  );

  const resetForm = (type: TransactionType = 'expense') => {
    setFormState(createEmptyForm(type));
    setFormErrors({});
    setEditingId(null);
  };

  const handleTypeChange = (nextType: TransactionType) => {
    const nextCategories = CATEGORY_PRESETS[nextType];

    setFormState((prev) => ({
      ...prev,
      type: nextType,
      category: nextCategories.includes(prev.category) ? prev.category : nextCategories[0]
    }));

    setFormErrors((prev) => ({ ...prev, category: undefined }));
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

    setTransactions((prev) => prev.filter((item) => item.id !== id));
    setNotice({ tone: 'success', message: '내역을 삭제했습니다.' });
    if (editingId === id) {
      resetForm();
    }
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
    if (!window.confirm('저장된 모든 거래 데이터를 초기화할까요? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    setTransactions([]);
    setSelectedMonth(getCurrentMonthKey());
    setFilter('all');
    resetForm('expense');
    setNotice({ tone: 'success', message: '모든 데이터를 초기화했습니다.' });
  };

  const categoryOptions = CATEGORY_PRESETS[formState.type];

  return (
    <main className="ledger-page">
      <section className="header-block">
        <p className="eyebrow">HOUSEHOLD LEDGER MVP</p>
        <h1>주말 배포용 가계부</h1>
        <p className="subcopy">수입/지출을 빠르게 기록하고 월별 흐름을 바로 확인하세요.</p>
      </section>

      <div className="status-area" role="status" aria-live="polite">
        {notice ? <p className={`toast ${notice.tone}`}>{notice.message}</p> : null}
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

      <section className="panel">
        <h2>데이터 관리</h2>
        <div className="data-tools">
          <button type="button" onClick={exportTransactions}>
            JSON 내보내기
          </button>

          <label className="file-picker">
            JSON 가져오기
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setImportFile(file);
              }}
            />
          </label>

          <label>
            가져오기 방식
            <select value={importMode} onChange={(event) => setImportMode(event.target.value as ImportMode)}>
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
        <h2>{editingId ? '내역 수정' : '내역 추가'}</h2>
        <form className="tx-form" onSubmit={handleSubmit} noValidate>
          <label>
            날짜
            <input
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

          <label>
            구분
            <select
              value={formState.type}
              onChange={(event) => handleTypeChange(event.target.value as TransactionType)}
            >
              <option value="income">수입</option>
              <option value="expense">지출</option>
            </select>
          </label>

          <label>
            카테고리
            <select
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

          <label>
            금액
            <input
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
              placeholder="예: 15000"
              required
            />
            {formErrors.amount ? <span className="field-error">{formErrors.amount}</span> : null}
          </label>

          <label className="memo-row">
            메모
            <input
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
          <label>
            월 선택
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            />
          </label>
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

        <ul className="tx-list">
          {monthlyTransactions.length === 0 ? (
            <li className="empty">조건에 맞는 내역이 없습니다.</li>
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
                  <button type="button" className="ghost" onClick={() => startEdit(item)}>
                    수정
                  </button>
                  <button type="button" className="danger" onClick={() => removeTransaction(item.id)}>
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
