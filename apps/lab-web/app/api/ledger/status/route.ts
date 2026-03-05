import { success } from '@/app/api/ledger/route-utils';
import { assertGoogleSheetsConfig, SheetsConfigError } from '@/lib/server/google-sheets';
import type { LedgerRemoteStatus } from '@/lib/ledger-api';

export const runtime = 'nodejs';

export async function GET() {
  try {
    assertGoogleSheetsConfig();
    return success<LedgerRemoteStatus>({ configured: true, missingEnv: [] });
  } catch (error) {
    if (error instanceof SheetsConfigError) {
      return success<LedgerRemoteStatus>({
        configured: false,
        missingEnv: error.missingEnv
      });
    }

    return success<LedgerRemoteStatus>({
      configured: false,
      missingEnv: []
    });
  }
}
