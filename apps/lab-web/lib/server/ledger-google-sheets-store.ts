import {
  parseCustomCategoriesWithRecovery,
  parseMonthlyBudgetsWithRecovery,
  parseTransactionsWithRecovery,
  sortTransactions
} from '@/lib/ledger';
import { createGoogleSheetsContext } from '@/lib/server/google-sheets';
import type { CategoryMap, MonthlyBudgetMap, Transaction } from '@/lib/types';

const TAB_TRANSACTIONS = 'Transactions';
const TAB_BUDGETS = 'Budgets';
const TAB_CATEGORIES = 'Categories';

interface SpreadsheetMetaResponse {
  sheets?: Array<{
    properties?: {
      title?: string;
    };
  }>;
}

interface SheetValuesResponse {
  values?: string[][];
}

const TAB_HEADERS: Array<{ title: string; headers: string[] }> = [
  {
    title: TAB_TRANSACTIONS,
    headers: ['id', 'date', 'type', 'category', 'amount', 'memo', 'createdAt', 'updatedAt']
  },
  {
    title: TAB_BUDGETS,
    headers: ['monthKey', 'budget']
  },
  {
    title: TAB_CATEGORIES,
    headers: ['type', 'name']
  }
];

function getHeaderRange(title: string, headers: string[]): string {
  const lastColumn = String.fromCharCode(64 + headers.length);
  return `${title}!A1:${lastColumn}1`;
}

async function ensureSheetSchema(): Promise<void> {
  const { sheetId, sheets } = await createGoogleSheetsContext();
  const metadata = await sheets.spreadsheets.get<SpreadsheetMetaResponse>({
    spreadsheetId: sheetId,
    fields: 'sheets(properties(sheetId,title))'
  });

  const existingTitles = new Set(metadata.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean));

  const addSheetRequests = TAB_HEADERS.filter((tab) => !existingTitles.has(tab.title)).map((tab) => ({
    addSheet: {
      properties: {
        title: tab.title
      }
    }
  }));

  if (addSheetRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: addSheetRequests
      }
    });
  }

  for (const tab of TAB_HEADERS) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: getHeaderRange(tab.title, tab.headers),
      valueInputOption: 'RAW',
      requestBody: {
        values: [tab.headers]
      }
    });
  }
}

async function clearBodyRange(range: string): Promise<void> {
  const { sheetId, sheets } = await createGoogleSheetsContext();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range
  });
}

async function updateBodyRows(range: string, rows: string[][]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const { sheetId, sheets } = await createGoogleSheetsContext();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values: rows
    }
  });
}

export async function readTransactionsFromSheet(): Promise<Transaction[]> {
  await ensureSheetSchema();

  const { sheetId, sheets } = await createGoogleSheetsContext();
  const response = await sheets.spreadsheets.values.get<SheetValuesResponse>({
    spreadsheetId: sheetId,
    range: `${TAB_TRANSACTIONS}!A2:H`
  });

  const rows = response.data.values ?? [];
  const parsedRows = rows.map((row) => ({
    id: row[0] ?? '',
    date: row[1] ?? '',
    type: row[2] === 'income' ? 'income' : row[2] === 'expense' ? 'expense' : '',
    category: row[3] ?? '',
    amount: Number(row[4] ?? 0),
    memo: row[5] ?? '',
    createdAt: row[6] ?? '',
    updatedAt: row[7] ?? ''
  }));

  return parseTransactionsWithRecovery(JSON.stringify(parsedRows)).data;
}

export async function writeTransactionsToSheet(transactions: Transaction[]): Promise<void> {
  await ensureSheetSchema();

  const normalizedTransactions = [...transactions].sort(sortTransactions);
  const rows = normalizedTransactions.map((transaction) => [
    transaction.id,
    transaction.date,
    transaction.type,
    transaction.category,
    String(transaction.amount),
    transaction.memo,
    transaction.createdAt,
    transaction.updatedAt
  ]);

  await clearBodyRange(`${TAB_TRANSACTIONS}!A2:H`);
  await updateBodyRows(`${TAB_TRANSACTIONS}!A2`, rows);
}

export async function readBudgetsFromSheet(): Promise<MonthlyBudgetMap> {
  await ensureSheetSchema();

  const { sheetId, sheets } = await createGoogleSheetsContext();
  const response = await sheets.spreadsheets.values.get<SheetValuesResponse>({
    spreadsheetId: sheetId,
    range: `${TAB_BUDGETS}!A2:B`
  });

  const rows = response.data.values ?? [];
  const parsed = rows.reduce<MonthlyBudgetMap>((acc, row) => {
    const monthKey = row[0] ?? '';
    const budget = Number(row[1] ?? 0);
    if (monthKey) {
      acc[monthKey] = budget;
    }
    return acc;
  }, {});

  return parseMonthlyBudgetsWithRecovery(JSON.stringify(parsed)).data;
}

export async function writeBudgetsToSheet(monthlyBudgets: MonthlyBudgetMap): Promise<void> {
  await ensureSheetSchema();

  const rows = Object.keys(monthlyBudgets)
    .sort((a, b) => a.localeCompare(b))
    .map((monthKey) => [monthKey, String(monthlyBudgets[monthKey])]);

  await clearBodyRange(`${TAB_BUDGETS}!A2:B`);
  await updateBodyRows(`${TAB_BUDGETS}!A2`, rows);
}

export async function readCategoriesFromSheet(): Promise<CategoryMap> {
  await ensureSheetSchema();

  const { sheetId, sheets } = await createGoogleSheetsContext();
  const response = await sheets.spreadsheets.values.get<SheetValuesResponse>({
    spreadsheetId: sheetId,
    range: `${TAB_CATEGORIES}!A2:B`
  });

  const rows = response.data.values ?? [];
  const parsed = rows.reduce<CategoryMap>(
    (acc, row) => {
      const type = row[0];
      const name = row[1];
      if ((type === 'income' || type === 'expense') && typeof name === 'string' && name.trim()) {
        acc[type].push(name.trim());
      }
      return acc;
    },
    { income: [], expense: [] }
  );

  return parseCustomCategoriesWithRecovery(JSON.stringify(parsed)).data;
}

export async function writeCategoriesToSheet(customCategories: CategoryMap): Promise<void> {
  await ensureSheetSchema();

  const rows = ([
    ...customCategories.income.map((name) => ['income', name]),
    ...customCategories.expense.map((name) => ['expense', name])
  ] satisfies string[][]);

  await clearBodyRange(`${TAB_CATEGORIES}!A2:B`);
  await updateBodyRows(`${TAB_CATEGORIES}!A2`, rows);
}
