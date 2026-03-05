import { NextResponse } from 'next/server';
import { SheetsConfigError } from '@/lib/server/google-sheets';
import type { LedgerApiResponse } from '@/lib/ledger-api';

export function success<T>(data: T): NextResponse<LedgerApiResponse<T>> {
  return NextResponse.json({ ok: true, data });
}

export function badRequest(message: string): NextResponse<LedgerApiResponse<never>> {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'BAD_REQUEST',
        message
      }
    },
    { status: 400 }
  );
}

export function handleLedgerApiError(error: unknown): NextResponse<LedgerApiResponse<never>> {
  if (error instanceof SheetsConfigError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: 'Google Sheets backend is not configured. Falling back to local mode is supported.',
          missingEnv: error.missingEnv
        }
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process ledger request.'
      }
    },
    { status: 500 }
  );
}
