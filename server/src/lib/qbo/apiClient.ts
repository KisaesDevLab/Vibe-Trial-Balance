// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Thin QuickBooks Online v3 API client — the four read-only calls an import
 * needs. Pure apart from the injected `fetchImpl` and `getAccessToken`.
 *
 * Every call runs inside the per-realm limiter with retry on 429/5xx. A 401
 * gets exactly ONE forced token refresh and retry; a second 401 propagates,
 * because looping on a dead grant is how a connection gets rate-limited.
 */
import { QBO_MINOR_VERSION } from './settings';
import { RetryableStatusError, withRetry, type RealmLimiter } from './limiter';
import type { FetchLike } from './oauth';
import type { QboAccountLite } from './matcher';

const REQUEST_TIMEOUT_MS = 60_000;
const QUERY_PAGE_SIZE = 1000;

export class QboApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'QboApiError';
    this.status = status;
  }
}

export interface QboApiDeps {
  baseUrl: string;
  realmId: string;
  /** `forceRefresh` = the last token was rejected with a 401. */
  getAccessToken: (forceRefresh: boolean) => Promise<string>;
  fetchImpl?: FetchLike;
  limiter?: RealmLimiter;
  sleep?: (ms: number) => Promise<void>;
}

export interface QboCompanyInfo {
  CompanyName: string;
  LegalName: string | null;
  Country: string | null;
  FiscalYearStartMonth: string | null;
}

export interface QboPreferences {
  /** `Accrual` or `Cash` — the company's default report basis. */
  reportBasis: 'Accrual' | 'Cash' | null;
  bookCloseDate: string | null;
}

export interface TrialBalanceParams {
  start_date: string;
  end_date: string;
  accounting_method: 'Accrual' | 'Cash';
}

export interface QboApi {
  companyInfo(): Promise<QboCompanyInfo>;
  preferences(): Promise<QboPreferences>;
  allAccounts(): Promise<QboAccountLite[]>;
  trialBalance(params: TrialBalanceParams): Promise<unknown>;
}

/** Pull a readable message out of a QBO Fault body without echoing the whole thing. */
function faultMessage(body: unknown, status: number): string {
  const o = (body ?? {}) as { Fault?: { Error?: Array<{ Message?: unknown; Detail?: unknown; code?: unknown }> } };
  const first = o.Fault?.Error?.[0];
  if (first) {
    const msg = typeof first.Message === 'string' ? first.Message : '';
    const detail = typeof first.Detail === 'string' ? first.Detail : '';
    const code = first.code !== undefined ? ` [${String(first.code)}]` : '';
    return `QuickBooks API error ${status}${code}: ${[msg, detail].filter(Boolean).join(' — ') || 'no detail'}`;
  }
  return `QuickBooks API error ${status}.`;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function createQboApi(deps: QboApiDeps): QboApi {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const companyBase = `${deps.baseUrl.replace(/\/+$/, '')}/v3/company/${encodeURIComponent(deps.realmId)}`;

  const rawGet = async (path: string, query: Record<string, string>, token: string): Promise<Response> => {
    const u = new URL(`${companyBase}/${path}`);
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
    u.searchParams.set('minorversion', QBO_MINOR_VERSION);
    return fetchImpl(u.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  };

  const get = async (path: string, query: Record<string, string>): Promise<unknown> => {
    const run = async (): Promise<unknown> =>
      withRetry(
        async () => {
          let token = await deps.getAccessToken(false);
          let res = await rawGet(path, query, token);
          if (res.status === 401) {
            token = await deps.getAccessToken(true);
            res = await rawGet(path, query, token);
          }
          if (res.status === 429 || res.status >= 500) {
            throw new RetryableStatusError(res.status, `QuickBooks API returned HTTP ${res.status}.`, res.headers.get('retry-after'));
          }
          let body: unknown = null;
          try {
            body = await res.json();
          } catch {
            body = null;
          }
          if (!res.ok) throw new QboApiError(res.status, faultMessage(body, res.status));
          return body;
        },
        { sleep: deps.sleep },
      );
    return deps.limiter ? deps.limiter.run(deps.realmId, run) : run();
  };

  return {
    async companyInfo() {
      const body = (await get(`companyinfo/${encodeURIComponent(deps.realmId)}`, {})) as { CompanyInfo?: Record<string, unknown> };
      const ci = body.CompanyInfo ?? {};
      return {
        CompanyName: str(ci.CompanyName) ?? '',
        LegalName: str(ci.LegalName),
        Country: str(ci.Country),
        FiscalYearStartMonth: str(ci.FiscalYearStartMonth),
      };
    },

    async preferences() {
      const body = (await get('preferences', {})) as {
        Preferences?: { ReportPrefs?: { ReportBasis?: unknown }; AccountingInfoPrefs?: { BookCloseDate?: unknown } };
      };
      const basis = str(body.Preferences?.ReportPrefs?.ReportBasis);
      return {
        reportBasis: basis === 'Accrual' || basis === 'Cash' ? basis : null,
        bookCloseDate: str(body.Preferences?.AccountingInfoPrefs?.BookCloseDate),
      };
    },

    /** Inactive accounts too — a balance can sit on an account made inactive after the fact. */
    async allAccounts() {
      const out: QboAccountLite[] = [];
      for (let start = 1; ; start += QUERY_PAGE_SIZE) {
        const query = `select * from Account where Active in (true, false) startposition ${start} maxresults ${QUERY_PAGE_SIZE}`;
        const body = (await get('query', { query })) as { QueryResponse?: { Account?: Array<Record<string, unknown>> } };
        const page = body.QueryResponse?.Account ?? [];
        for (const a of page) {
          const id = str(a.Id);
          if (!id) continue;
          out.push({
            Id: id,
            Name: str(a.Name) ?? '',
            FullyQualifiedName: str(a.FullyQualifiedName) ?? str(a.Name) ?? '',
            AcctNum: str(a.AcctNum),
            Classification: str(a.Classification),
            AccountType: str(a.AccountType),
            Active: a.Active !== false,
          });
        }
        if (page.length < QUERY_PAGE_SIZE) break;
      }
      return out;
    },

    async trialBalance(params) {
      return get('reports/TrialBalance', {
        start_date: params.start_date,
        end_date: params.end_date,
        accounting_method: params.accounting_method,
      });
    },
  };
}
