const REQUIRED_ENV_NAMES = ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEET_ID'] as const;

export class SheetsConfigError extends Error {
  readonly code = 'SHEETS_CONFIG_MISSING' as const;
  readonly missingEnv: string[];

  constructor(missingEnv: string[]) {
    super(`Google Sheets config is missing required env vars: ${missingEnv.join(', ')}`);
    this.name = 'SheetsConfigError';
    this.missingEnv = missingEnv;
  }
}

export interface GoogleSheetsContext {
  sheetId: string;
  sheets: {
    spreadsheets: {
      get: <T = unknown>(params: unknown) => Promise<{ data: T }>;
      batchUpdate: <T = unknown>(params: unknown) => Promise<{ data: T }>;
      values: {
        get: <T = unknown>(params: unknown) => Promise<{ data: T }>;
        update: <T = unknown>(params: unknown) => Promise<{ data: T }>;
        clear: <T = unknown>(params: unknown) => Promise<{ data: T }>;
      };
    };
  };
}

function getMissingEnvNames(): string[] {
  return REQUIRED_ENV_NAMES.filter((name) => {
    const value = process.env[name];
    return !value || value.trim().length === 0;
  });
}

export function assertGoogleSheetsConfig(): void {
  const missingEnv = getMissingEnvNames();
  if (missingEnv.length > 0) {
    throw new SheetsConfigError(missingEnv);
  }
}

async function loadGoogleApisModule() {
  const moduleName = 'googleapis';
  try {
    return await import(moduleName);
  } catch {
    throw new Error('googleapis package is not installed. Run `npm install` before enabling remote storage.');
  }
}

export async function createGoogleSheetsContext(): Promise<GoogleSheetsContext> {
  assertGoogleSheetsConfig();
  const { google } = await loadGoogleApisModule();

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL as string;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY as string).replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID as string;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return {
    sheetId,
    sheets: google.sheets({ version: 'v4', auth })
  };
}
