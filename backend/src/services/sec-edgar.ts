import { supabaseAdmin } from '../config/supabase';
import { generateText } from './gemini';
import { logger } from '../config/logger';


const EDGAR_SUBMISSIONS = 'https://data.sec.gov/submissions';

// EDGAR requires a User-Agent header with contact info
const EDGAR_HEADERS = {
  'User-Agent': 'FinIntel financial-platform contact@finintel.app',
  'Accept-Encoding': 'gzip, deflate',
};

export interface SecFiling {
  accessionNumber: string;
  filingDate: string;
  form: string;
  primaryDocument: string;
  description: string;
  url: string;
}

export interface SecAlert {
  ticker: string;
  companyName: string;
  filing: SecFiling;
  aiSummary: string;
}

// ── CIK lookup ────────────────────────────────────────────

/**
 * Look up a company's CIK (Central Index Key) by ticker symbol.
 * CIK is required for all EDGAR API calls.
 */
export async function lookupCik(ticker: string): Promise<string | null> {
  try {
    // Use the company tickers JSON endpoint from SEC EDGAR
    const tickerRes = await fetch(
      'https://www.sec.gov/files/company_tickers.json',
      { headers: EDGAR_HEADERS }
    );
    const data = await tickerRes.json() as Record<string, { cik_str: string; ticker: string; title: string }>;

    const match = Object.values(data).find(
      (c) => c.ticker.toUpperCase() === ticker.toUpperCase()
    );
    return match ? String(match.cik_str).padStart(10, '0') : null;
  } catch (err) {
    logger.warn('EDGAR CIK lookup failed', { ticker, err });
    return null;
  }
}

// ── Recent filings ────────────────────────────────────────

/**
 * Fetch the most recent filings for a company by CIK.
 * Filters to the most important form types for financial analysis.
 */
export async function getRecentFilings(
  cik: string,
  formTypes: string[] = ['10-K', '10-Q', '8-K', 'DEF 14A'],
  limit = 10
): Promise<SecFiling[]> {
  try {
    const res = await fetch(
      `${EDGAR_SUBMISSIONS}/CIK${cik}.json`,
      { headers: EDGAR_HEADERS }
    );
    const data = await res.json() as {
      filings: {
        recent: {
          accessionNumber: string[];
          filingDate: string[];
          form: string[];
          primaryDocument: string[];
          primaryDocDescription: string[];
        };
      };
    };

    const recent = data.filings.recent;
    const filings: SecFiling[] = [];

    for (let i = 0; i < recent.accessionNumber.length && filings.length < limit; i++) {
      const form = recent.form[i];
      if (!form || !formTypes.includes(form)) continue;

      const accession = recent.accessionNumber[i]!.replace(/-/g, '');
      const primaryDoc = recent.primaryDocument[i] ?? '';
      const url = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accession}/${primaryDoc}`;

      filings.push({
        accessionNumber: recent.accessionNumber[i]!,
        filingDate: recent.filingDate[i]!,
        form: form,
        primaryDocument: primaryDoc,
        description: recent.primaryDocDescription?.[i] ?? form,
        url,
      });
    }

    return filings;
  } catch (err) {
    logger.warn('EDGAR filings fetch failed', { cik, err: err instanceof Error ? err.stack : err });
    return [];
  }
}

/**
 * Fetch the text of a filing document (first 8000 chars for Gemini context window).
 */
export async function getFilingText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: EDGAR_HEADERS });
    const text = await res.text();
    // Strip HTML tags and clean up
    const cleaned = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s{3,}/g, '\n\n')
      .trim()
      .slice(0, 8000);
    return cleaned;
  } catch {
    return '';
  }
}

// ── AI summary of a filing ────────────────────────────────

export async function summarizeFiling(
  companyName: string,
  filing: SecFiling,
  filingText: string
): Promise<string> {
  if (!filingText.trim()) return `${filing.form} filed on ${filing.filingDate}. Full document available at SEC EDGAR.`;

  const prompt = `Summarize this SEC ${filing.form} filing from ${companyName} (filed ${filing.filingDate}) in 3-4 concise bullet points for a financial analyst. Focus on: key financial figures, strategic announcements, risk disclosures, and anything materially significant.

FILING EXCERPT:
${filingText}

Provide 3-4 bullet points only. Be specific with numbers.`;

  try {
    return await generateText(prompt, { temperature: 0.1, maxOutputTokens: 512 });
  } catch {
    return `${filing.form} filed on ${filing.filingDate}. See full document at: ${filing.url}`;
  }
}

// ── Monitor and create alerts ─────────────────────────────

/**
 * Check for new SEC filings for all tracked companies in an org.
 * Creates alert records for any filings newer than the last check.
 * Called by n8n on a schedule (daily).
 */
export async function monitorSecFilings(orgId: string): Promise<number> {
  const { data: companies } = await supabaseAdmin
    .from('companies')
    .select('id, name, ticker')
    .eq('org_id', orgId)
    .eq('is_tracked', true)
    .not('ticker', 'is', null);

  if (!companies?.length) return 0;

  let alertsCreated = 0;

  for (const company of companies) {
    if (!company.ticker) continue;

    try {
      const cik = await lookupCik(company.ticker);
      if (!cik) continue;

      const filings = await getRecentFilings(cik, ['10-K', '10-Q', '8-K'], 5);
      if (!filings.length) continue;

      // Check the most recent filing — if we haven't alerted on it yet
      const latestFiling = filings[0]!;

      const { data: existing } = await supabaseAdmin
        .from('alerts')
        .select('id')
        .eq('org_id', orgId)
        .eq('company_id', company.id)
        .eq('alert_type', 'sec_filing')
        .contains('metadata', { accessionNumber: latestFiling.accessionNumber })
        .single();

      if (existing) continue; // Already alerted

      // Fetch and summarize the filing
      const filingText = await getFilingText(latestFiling.url);
      const summary = await summarizeFiling(company.name, latestFiling, filingText);

      // Create the alert
      await supabaseAdmin.from('alerts').insert({
        org_id: orgId,
        company_id: company.id,
        alert_type: 'sec_filing',
        title: `${company.name} filed ${latestFiling.form} — ${latestFiling.filingDate}`,
        summary,
        source_url: latestFiling.url,
        metadata: {
          accessionNumber: latestFiling.accessionNumber,
          form: latestFiling.form,
          filingDate: latestFiling.filingDate,
          ticker: company.ticker,
        },
      });

      alertsCreated++;
    } catch (err) {
      logger.warn('SEC monitoring failed for company', { companyId: company.id, err });
    }
  }

  return alertsCreated;
}
