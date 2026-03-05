import { parseCustomCategoriesWithRecovery } from '@/lib/ledger';
import {
  readCategoriesFromSheet,
  writeCategoriesToSheet
} from '@/lib/server/ledger-google-sheets-store';
import { badRequest, handleLedgerApiError, success } from '@/app/api/ledger/route-utils';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const customCategories = await readCategoriesFromSheet();
    return success(customCategories);
  } catch (error) {
    return handleLedgerApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { customCategories?: unknown };
    const parsed = parseCustomCategoriesWithRecovery(JSON.stringify(body.customCategories));

    if (parsed.recovered) {
      return badRequest('Invalid customCategories payload.');
    }

    await writeCategoriesToSheet(parsed.data);
    return success(parsed.data);
  } catch (error) {
    return handleLedgerApiError(error);
  }
}
