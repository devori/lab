import { parseTransactionsWithRecovery } from '@/lib/ledger';
import {
  readTransactionsFromSheet,
  writeTransactionsToSheet
} from '@/lib/server/ledger-google-sheets-store';
import { badRequest, handleLedgerApiError, success } from '@/app/api/ledger/route-utils';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const transactions = await readTransactionsFromSheet();
    return success(transactions);
  } catch (error) {
    return handleLedgerApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { transactions?: unknown };
    const parsed = parseTransactionsWithRecovery(JSON.stringify(body.transactions));

    if (parsed.recovered) {
      return badRequest('Invalid transactions payload.');
    }

    await writeTransactionsToSheet(parsed.data);
    return success(parsed.data);
  } catch (error) {
    return handleLedgerApiError(error);
  }
}
