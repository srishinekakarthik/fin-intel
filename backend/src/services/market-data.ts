import axios from 'axios';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { logger } from '../config/logger';

const finnhub = axios.create({
  baseURL: 'https://finnhub.io/api/v1',
  params: { token: env.FINNHUB_API_KEY },
  timeout: 10_000,
});

// ── Types ─────────────────────────────────────────────────

export interface StockQuote {
  ticker: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

export interface CompanyProfile {
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  marketCap: number;
  shareOutstanding: number;
  logo: string;
  weburl: string;
  ipo: string;
  currency: string;
}

export interface CompanyNews {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  image: string;
}

export interface BasicFinancials {
  ticker: string;
  peRatio: number | null;
  eps: number | null;
  revenuePerShare: number | null;
  revenueGrowthYoy: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  returnOnEquity: number | null;
  week52High: number | null;
  week52Low: number | null;
}

// ── API calls ─────────────────────────────────────────────

export async function getStockQuote(ticker: string): Promise<StockQuote | null> {
  if (!env.FINNHUB_API_KEY) return null;
  try {
    const { data } = await finnhub.get('/quote', { params: { symbol: ticker } });
    if (!data.c) return null;
    return {
      ticker,
      currentPrice: data.c,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      timestamp: data.t,
    };
  } catch (err) {
    logger.warn(`Finnhub quote failed for ${ticker}`, { err });
    return null;
  }
}

export async function getCompanyProfile(ticker: string): Promise<CompanyProfile | null> {
  if (!env.FINNHUB_API_KEY) return null;
  try {
    const { data } = await finnhub.get('/stock/profile2', { params: { symbol: ticker } });
    if (!data.name) return null;
    return {
      ticker,
      name: data.name,
      exchange: data.exchange,
      sector: data.finnhubIndustry,
      industry: data.finnhubIndustry,
      marketCap: data.marketCapitalization * 1_000_000,
      shareOutstanding: data.shareOutstanding,
      logo: data.logo,
      weburl: data.weburl,
      ipo: data.ipo,
      currency: data.currency,
    };
  } catch (err) {
    logger.warn(`Finnhub profile failed for ${ticker}`, { err });
    return null;
  }
}

export async function getCompanyNews(
  ticker: string,
  fromDate: string,
  toDate: string
): Promise<CompanyNews[]> {
  if (!env.FINNHUB_API_KEY) return [];
  try {
    const { data } = await finnhub.get('/company-news', {
      params: { symbol: ticker, from: fromDate, to: toDate },
    });
    return (data || []).slice(0, 10);
  } catch {
    return [];
  }
}

export async function getBasicFinancials(ticker: string): Promise<BasicFinancials | null> {
  if (!env.FINNHUB_API_KEY) return null;
  try {
    const { data } = await finnhub.get('/stock/metric', {
      params: { symbol: ticker, metric: 'all' },
    });
    const m = data.metric || {};
    return {
      ticker,
      peRatio: m.peAnnual ?? null,
      eps: m.epsAnnual ?? null,
      revenuePerShare: m.revenuePerShareAnnual ?? null,
      revenueGrowthYoy: m.revenueGrowthAnnual ?? null,
      grossMargin: m.grossMarginAnnual ?? null,
      netMargin: m.netMarginAnnual ?? null,
      debtToEquity: m.totalDebt_totalEquityAnnual ?? null,
      currentRatio: m.currentRatioAnnual ?? null,
      returnOnEquity: m.roeAnnual ?? null,
      week52High: m['52WeekHigh'] ?? null,
      week52Low: m['52WeekLow'] ?? null,
    };
  } catch {
    return null;
  }
}

// ── Snapshot persistence ──────────────────────────────────

/**
 * Fetch fresh market data for a company and persist to company_snapshots.
 * Called on-demand from the market data endpoint and by n8n scheduled workflows.
 */
export async function refreshCompanySnapshot(
  companyId: string,
  ticker: string
): Promise<void> {
  const [quote, profile, financials] = await Promise.all([
    getStockQuote(ticker),
    getCompanyProfile(ticker),
    getBasicFinancials(ticker),
  ]);

  const snapshotData: Record<string, unknown> = {
    company_id: companyId,
    snapshot_at: new Date().toISOString(),
  };

  if (quote) {
    snapshotData.stock_price = quote.currentPrice;
    snapshotData.market_cap = profile?.marketCap ?? null;
    snapshotData.pe_ratio = financials?.peRatio ?? null;
    snapshotData.financials = {
      change: quote.change,
      changePercent: quote.changePercent,
      high52w: financials?.week52High,
      low52w: financials?.week52Low,
      grossMargin: financials?.grossMargin,
      netMargin: financials?.netMargin,
      debtToEquity: financials?.debtToEquity,
      returnOnEquity: financials?.returnOnEquity,
      currentRatio: financials?.currentRatio,
      revenueGrowthYoy: financials?.revenueGrowthYoy,
    };
  }

  await supabaseAdmin.from('company_snapshots').insert(snapshotData);
}
