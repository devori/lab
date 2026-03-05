'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CATEGORY_PRESETS,
  formatKRW,
  getCurrentMonthKey,
  getMonthlySummary,
  getTodayDate,
  getTypeLabel,
  parseTransactions,
  sortTransactions,
  STORAGE_KEY
} from '@/lib/ledger';
import type { Transaction, TransactionFilter, TransactionType } from '@/lib/types';

interface TransactionFormState {
  date: string;
  type: TransactionType;
  category: string;
  amount: string;
  memo: string;
}

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

  const thisMonthKey = getCurrentMonthKey();

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  const thisMonthSummary = useMemo(
    () => getMonthlySummary(transactions, thisMonthKey),
    [transactions, thisMonthKey]
  );

  const monthlyTransactions = useMemo(() => {
    return transactions
      .filter((item) => item.date.slice(0, 7) === selectedMonth)
      .filter((item) => (filter === 'all' ? true : item.type === filter));
  }, [transactions, selectedMonth, filter]);

  const resetForm = (type: TransactionType = 'expense') => {
    setFormState(createEmptyForm(type));
    setEditingId(null);
  };

  const handleTypeChange = (nextType: TransactionType) => {
    const nextCategories = CATEGORY_PRESETS[nextType];

    setFormState((prev) => ({
      ...prev,
      type: nextType,
      category: nextCategories.includes(prev.category) ? prev.category : nextCategories[0]
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const amount = Number(formState.amount);
    if (!formState.date || !formState.category || !Number.isFinite(amount) || amount <= 0) {
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
    resetForm(formState.type);
  };

  const startEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
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
    if (editingId === id) {
      resetForm();
    }
  };

  const categoryOptions = CATEGORY_PRESETS[formState.type];

  return (
    <main className="ledger-page">
      <section className="header-block">
        <p className="eyebrow">HOUSEHOLD LEDGER MVP</p>
        <h1>주말 배포용 가계부</h1>
        <p className="subcopy">수입/지출을 빠르게 기록하고 월별 흐름을 바로 확인하세요.</p>
      </section>

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
        <h2>{editingId ? '내역 수정' : '내역 추가'}</h2>
        <form className="tx-form" onSubmit={handleSubmit}>
          <label>
            날짜
            <input
              type="date"
              value={formState.date}
              onChange={(event) => setFormState((prev) => ({ ...prev, date: event.target.value }))}
              required
            />
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
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, category: event.target.value }))
              }
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label>
            금액
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={formState.amount}
              onChange={(event) => setFormState((prev) => ({ ...prev, amount: event.target.value }))}
              placeholder="예: 15000"
              required
            />
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
    </main>
  );
}
