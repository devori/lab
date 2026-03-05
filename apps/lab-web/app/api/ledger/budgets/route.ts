import { parseMonthlyBudgetsWithRecovery } from '@/lib/ledger';
import { readBudgetsFromSheet, writeBudgetsToSheet } from '@/lib/server/ledger-google-sheets-store';
import { badRequest, handleLedgerApiError, success } from '@/app/api/ledger/route-utils';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const monthlyBudgets = await readBudgetsFromSheet();
    return success(monthlyBudgets);
  } catch (error) {
    return handleLedgerApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { monthlyBudgets?: unknown };
    const parsed = parseMonthlyBudgetsWithRecovery(JSON.stringify(body.monthlyBudgets));

    if (parsed.recovered) {
      return badRequest('Invalid monthlyBudgets payload.');
    }

    await writeBudgetsToSheet(parsed.data);
    return success(parsed.data);
  } catch (error) {
    return handleLedgerApiError(error);
  }
}
