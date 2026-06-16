import { supabaseAdmin } from '../config/supabase';
import { getStockQuote, getCompanyProfile, getBasicFinancials, getCompanyNews } from './market-data';
import { lookupCik, getRecentFilings, getFilingText } from './sec-edgar';
import { logger } from '../config/logger';

// ── Types ─────────────────────────────────────────────────

export interface ExternalSource {
  type: 'stock_quote' | 'financials' | 'news' | 'sec_filing' | 'yahoo_finance';
  label: string;
  content: string;
}

export interface ExternalContext {
  sources: ExternalSource[];
  tickers: string[];
  hasData: boolean;
}

// ── Intent detection ──────────────────────────────────────

const FILING_KEYWORDS = /\b(10-?k|10-?q|8-?k|annual report|quarterly report|sec filing|edgar|proxy|def.?14a|form 4)\b/i;
const STOCK_KEYWORDS = /\b(stock price|share price|current price|trading at|market cap|ticker|quote|52.?week|ipo)\b/i;
const NEWS_KEYWORDS = /\b(news|headline|earnings|announcement|press release|guidance|forecast|analyst|upgrade|downgrade|beat|miss)\b/i;
const METRIC_KEYWORDS = /\b(p\/e|pe ratio|eps|revenue|profit|margin|debt|equity|roe|current ratio|ebitda|cash flow|balance sheet|income statement|financial metrics)\b/i;

interface Intent {
  wantsStockQuote: boolean;
  wantsFinancials: boolean;
  wantsNews: boolean;
  wantsFiling: boolean;
}

function detectIntent(query: string): Intent {
  return {
    wantsStockQuote: STOCK_KEYWORDS.test(query),
    wantsFinancials: METRIC_KEYWORDS.test(query),
    wantsNews: NEWS_KEYWORDS.test(query),
    wantsFiling: FILING_KEYWORDS.test(query),
  };
}

// ── Ticker extraction ─────────────────────────────────────

/**
 * Extract stock tickers from a query.
 * Looks for:
 *   1. Explicit uppercase tickers (e.g. NVDA, AAPL, TSLA)
 *   2. Company names matched against the org's companies table
 */
async function extractTickers(query: string, orgId: string): Promise<string[]> {
  const found = new Set<string>();

  // 1. Explicit all-caps tickers (2-5 letters)
  const explicitMatches = query.match(/\b([A-Z]{1,5})\b/g) ?? [];
  // Filter out common English words and financial acronyms that aren't tickers
  const STOPWORDS = new Set(['I', 'A', 'OR', 'FOR', 'AND', 'THE', 'OF', 'IN', 'ON', 'AT', 'TO',
    'BY', 'AS', 'IS', 'IT', 'BE', 'DO', 'IF', 'NO', 'US', 'UK', 'EU', 'AI', 'PE', 'IPO',
    'SEC', 'ETF', 'CEO', 'CFO', 'EPS', 'ROE', 'YOY', 'TTM', 'Q1', 'Q2', 'Q3', 'Q4', 'YTD',
    'P', 'E', 'K', 'Q', 'M', 'B', 'T', 'S', 'N',
  ]);
  for (const t of explicitMatches) {
    if (!STOPWORDS.has(t) && t.length >= 2) found.add(t);
  }

  // 2. Company name match from org's companies table
  try {
    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('ticker, name')
      .eq('org_id', orgId)
      .not('ticker', 'is', null);

    for (const company of companies ?? []) {
      if (!company.ticker) continue;
      const nameWords = company.name.toLowerCase().split(/\s+/);
      const queryLower = query.toLowerCase();
      // Match if any significant word from the company name appears in the query
      const matched = nameWords.some(
        (word: string) => word.length > 3 && queryLower.includes(word)
      );
      if (matched) found.add(company.ticker.toUpperCase());
    }
  } catch (err) {
    logger.warn('Ticker extraction: company lookup failed', { err });
  }

  return [...found].slice(0, 3); // Cap at 3 tickers to avoid spamming APIs
}

// ── Individual data fetchers ──────────────────────────────

/** Wraps any async call with a timeout — returns null on timeout or error */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
  try {
    const result = await Promise.race([promise, timeout]);
    return result;
  } catch (err) {
    logger.warn(`External context: ${label} failed`, { err });
    return null;
  }
}

async function fetchStockContext(ticker: string): Promise<ExternalSource | null> {
  const [quote, profile, financials] = await Promise.all([
    withTimeout(getStockQuote(ticker), 5000, `Finnhub quote ${ticker}`),
    withTimeout(getCompanyProfile(ticker), 5000, `Finnhub profile ${ticker}`),
    withTimeout(getBasicFinancials(ticker), 5000, `Finnhub financials ${ticker}`),
  ]);

  if (!quote) return null;

  const lines: string[] = [
    `**${profile?.name ?? ticker} (${ticker}) — Live Quote**`,
    `Price: $${quote.currentPrice} | Change: ${quote.change >= 0 ? '+' : ''}${quote.change} (${quote.changePercent?.toFixed(2)}%)`,
    `High: $${quote.high} | Low: $${quote.low} | Prev Close: $${quote.previousClose}`,
  ];

  if (profile?.marketCap) {
    lines.push(`Market Cap: $${(profile.marketCap / 1_000_000_000).toFixed(2)}B`);
  }

  if (financials) {
    const metrics = [
      financials.peRatio ? `P/E: ${financials.peRatio.toFixed(2)}` : null,
      financials.eps ? `EPS: $${financials.eps.toFixed(2)}` : null,
      financials.grossMargin ? `Gross Margin: ${financials.grossMargin.toFixed(1)}%` : null,
      financials.netMargin ? `Net Margin: ${financials.netMargin.toFixed(1)}%` : null,
      financials.week52High ? `52W High: $${financials.week52High}` : null,
      financials.week52Low ? `52W Low: $${financials.week52Low}` : null,
      financials.returnOnEquity ? `ROE: ${financials.returnOnEquity.toFixed(1)}%` : null,
      financials.debtToEquity ? `D/E: ${financials.debtToEquity.toFixed(2)}` : null,
    ].filter(Boolean);
    if (metrics.length) lines.push(`Key Metrics: ${metrics.join(' | ')}`);
  }

  return {
    type: 'stock_quote',
    label: `Finnhub — ${ticker} Live Data`,
    content: lines.join('\n'),
  };
}

async function fetchNewsContext(ticker: string): Promise<ExternalSource | null> {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().split('T')[0]!;

  const news = await withTimeout(
    getCompanyNews(ticker, fmt(weekAgo), fmt(today)),
    5000,
    `Finnhub news ${ticker}`
  );
  if (!news?.length) return null;

  const articles = news.slice(0, 5).map((n, i) =>
    `${i + 1}. [${new Date(n.datetime * 1000).toLocaleDateString()}] ${n.headline}\n   Source: ${n.source} — ${n.summary?.slice(0, 150) ?? ''}`
  );

  return {
    type: 'news',
    label: `Finnhub — ${ticker} Recent News`,
    content: `**${ticker} — Recent Financial News (Last 7 Days)**\n\n${articles.join('\n\n')}`,
  };
}

async function fetchSecContext(ticker: string): Promise<ExternalSource | null> {
  const cik = await withTimeout(lookupCik(ticker), 5000, `EDGAR CIK ${ticker}`);
  if (!cik) return null;

  const filings = await withTimeout(
    getRecentFilings(cik, ['10-K', '10-Q', '8-K'], 3),
    5000,
    `EDGAR filings ${ticker}`
  );
  if (!filings?.length) return null;

  // Fetch text of the most recent filing only (to keep latency low)
  const latestFiling = filings[0]!;
  const filingText = await withTimeout(
    getFilingText(latestFiling.url),
    8000,
    `EDGAR text ${ticker}`
  );

  const filingLines = filings.map((f) =>
    `• ${f.form} — Filed: ${f.filingDate} | ${f.description}\n  URL: ${f.url}`
  );

  const content = [
    `**${ticker} — Recent SEC Filings (via EDGAR)**`,
    '',
    filingLines.join('\n'),
    '',
    filingText
      ? `**Most Recent Filing Excerpt (${latestFiling.form}, ${latestFiling.filingDate}):**\n${filingText.slice(0, 3000)}`
      : '',
  ].filter(Boolean).join('\n');

  return {
    type: 'sec_filing',
    label: `SEC EDGAR — ${ticker} Filings`,
    content,
  };
}

async function fetchYahooContext(ticker: string): Promise<ExternalSource | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=financialData,defaultKeyStatistics,summaryDetail`;
    const resp = await withTimeout(
      fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      6000,
      `Yahoo Finance ${ticker}`
    );
    if (!resp) return null;

    const json = await resp.json() as {
      quoteSummary?: {
        result?: Array<{
          financialData?: Record<string, { raw?: number; fmt?: string }>;
          defaultKeyStatistics?: Record<string, { raw?: number; fmt?: string }>;
          summaryDetail?: Record<string, { raw?: number; fmt?: string }>;
        }>;
      };
    };

    const result = json.quoteSummary?.result?.[0];
    if (!result) return null;

    const fd = result.financialData ?? {};
    const ks = result.defaultKeyStatistics ?? {};
    const sd = result.summaryDetail ?? {};

    const metrics: string[] = [
      fd.totalRevenue?.fmt ? `Total Revenue (TTM): ${fd.totalRevenue.fmt}` : null,
      fd.grossProfits?.fmt ? `Gross Profit (TTM): ${fd.grossProfits.fmt}` : null,
      fd.ebitda?.fmt ? `EBITDA: ${fd.ebitda.fmt}` : null,
      fd.freeCashflow?.fmt ? `Free Cash Flow: ${fd.freeCashflow.fmt}` : null,
      fd.totalDebt?.fmt ? `Total Debt: ${fd.totalDebt.fmt}` : null,
      fd.totalCash?.fmt ? `Total Cash: ${fd.totalCash.fmt}` : null,
      fd.returnOnEquity?.fmt ? `Return on Equity: ${fd.returnOnEquity.fmt}` : null,
      fd.returnOnAssets?.fmt ? `Return on Assets: ${fd.returnOnAssets.fmt}` : null,
      fd.revenueGrowth?.fmt ? `Revenue Growth (YoY): ${fd.revenueGrowth.fmt}` : null,
      fd.earningsGrowth?.fmt ? `Earnings Growth (YoY): ${fd.earningsGrowth.fmt}` : null,
      ks.trailingEps?.fmt ? `EPS (TTM): ${ks.trailingEps.fmt}` : null,
      ks.forwardEps?.fmt ? `EPS (Forward): ${ks.forwardEps.fmt}` : null,
      ks.priceToBook?.fmt ? `Price/Book: ${ks.priceToBook.fmt}` : null,
      sd.dividendYield?.fmt ? `Dividend Yield: ${sd.dividendYield.fmt}` : null,
      sd.payoutRatio?.fmt ? `Payout Ratio: ${sd.payoutRatio.fmt}` : null,
    ].filter(Boolean) as string[];

    if (!metrics.length) return null;

    return {
      type: 'yahoo_finance',
      label: `Yahoo Finance — ${ticker} Financials`,
      content: `**${ticker} — Detailed Financials (Yahoo Finance)**\n\n${metrics.join('\n')}`,
    };
  } catch (err) {
    logger.warn('Yahoo Finance fetch failed', { ticker, err });
    return null;
  }
}

// ── Main orchestrator ─────────────────────────────────────

/**
 * Build external financial context for a user's question.
 *
 * Detects intent, extracts tickers, and fetches relevant data sources
 * in parallel. All fetches are timeout-gated so a slow API never
 * blocks the chat response for more than ~8 seconds.
 *
 * @param query  - The user's question
 * @param orgId  - For company name → ticker matching
 * @param sessionCompanyTicker - Pre-known ticker if session is company-scoped
 */
export async function buildExternalContext(
  query: string,
  orgId: string,
  sessionCompanyTicker?: string | null
): Promise<ExternalContext> {
  const intent = detectIntent(query);
  const needsExternalData =
    intent.wantsStockQuote || intent.wantsFinancials || intent.wantsNews || intent.wantsFiling;

  // If the query doesn't look like it needs live financial data, skip all external fetches
  if (!needsExternalData) {
    return { sources: [], tickers: [], hasData: false };
  }

  // Extract relevant tickers
  const tickers = await extractTickers(query, orgId);
  if (sessionCompanyTicker && !tickers.includes(sessionCompanyTicker.toUpperCase())) {
    tickers.unshift(sessionCompanyTicker.toUpperCase());
  }

  if (!tickers.length) {
    return { sources: [], tickers: [], hasData: false };
  }

  logger.info('External context: fetching data', { tickers, intent });

  // For each ticker, launch parallel fetches based on intent
  const fetchPromises: Promise<ExternalSource | null>[] = [];

  for (const ticker of tickers) {
    if (intent.wantsStockQuote || intent.wantsFinancials) {
      fetchPromises.push(fetchStockContext(ticker));
    }
    if (intent.wantsFinancials) {
      fetchPromises.push(fetchYahooContext(ticker));
    }
    if (intent.wantsNews) {
      fetchPromises.push(fetchNewsContext(ticker));
    }
    if (intent.wantsFiling) {
      fetchPromises.push(fetchSecContext(ticker));
    }
  }

  const results = await Promise.all(fetchPromises);
  const sources = results.filter((r): r is ExternalSource => r !== null);

  logger.info('External context: fetched', { sourcesCount: sources.length, tickers });

  return {
    sources,
    tickers,
    hasData: sources.length > 0,
  };
}
