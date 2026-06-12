import { supabaseAdmin } from '../config/supabase';
import { generateText } from './gemini';
import { semanticSearch } from './vector-search';
import { getStockQuote, getBasicFinancials } from './market-data';


export interface InvestmentMemo {
  companyName: string;
  ticker: string | null;
  generatedAt: string;
  content: string;
}

/**
 * Generate a professional investment memo for a company.
 * Pulls from indexed documents + live market data.
 * Format mirrors a real sell-side research note.
 */
export async function generateInvestmentMemo(
  orgId: string,
  companyId: string
): Promise<InvestmentMemo> {
  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('id, name, ticker, sector, industry, description')
    .eq('id', companyId)
    .eq('org_id', orgId)
    .single();

  if (!company) throw new Error('Company not found');

  // Gather document context across key financial dimensions
  const queryPairs: Array<[string, string]> = [
    ['overview', 'business overview products services revenue model competitive advantage'],
    ['financials', 'revenue growth net income profit margin earnings per share cash flow'],
    ['strategy', 'strategic priorities growth initiatives market expansion product roadmap'],
    ['risks', 'risk factors challenges competition regulatory market risks uncertainties'],
    ['outlook', 'guidance future outlook management commentary next quarter annual forecast'],
  ];

  const contextSections: Record<string, string> = {};
  for (const [key, query] of queryPairs) {
    const chunks = await semanticSearch(query, orgId, {
      companyId, topK: 5, threshold: 0.50,
    });
    if (chunks.length) {
      contextSections[key] = chunks
        .map(c => `[${c.docTitle}, p.${c.pageNumber}]\n${c.content}`)
        .join('\n\n');
    }
  }

  // Fetch live market data
  const [quote, financials] = await Promise.all([
    company.ticker ? getStockQuote(company.ticker) : null,
    company.ticker ? getBasicFinancials(company.ticker) : null,
  ]);

  // Build market data block
  const marketBlock = quote || financials ? `
MARKET DATA (Live):
${quote ? `Current Price: $${quote.currentPrice} | Change: ${quote.changePercent?.toFixed(2)}%` : ''}
${financials?.peRatio ? `P/E Ratio: ${financials.peRatio}` : ''}
${financials?.revenueGrowthYoy ? `Revenue Growth YoY: ${financials.revenueGrowthYoy}%` : ''}
${financials?.grossMargin ? `Gross Margin: ${financials.grossMargin}%` : ''}
${financials?.netMargin ? `Net Margin: ${financials.netMargin}%` : ''}
${financials?.debtToEquity ? `Debt/Equity: ${financials.debtToEquity}` : ''}
${financials?.returnOnEquity ? `Return on Equity: ${financials.returnOnEquity}%` : ''}
`.trim() : 'Market data not available.';

  const hasDocContext = Object.values(contextSections).some(v => v.length > 0);

  const prompt = `You are a senior equity research analyst. Write a professional Investment Memo for ${company.name}${company.ticker ? ` (${company.ticker})` : ''}.

${marketBlock}

${hasDocContext ? `DOCUMENT CONTEXT FROM FILINGS & REPORTS:

${Object.entries(contextSections).map(([k, v]) => `--- ${k.toUpperCase()} ---\n${v}`).join('\n\n')}` : 'Note: Limited document context available. Base analysis on market data provided.'}

Write a structured investment memo with these sections:

# Investment Memo: ${company.name}${company.ticker ? ` (${company.ticker})` : ''}
*${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}*

## Company Overview
## Investment Thesis
## Financial Analysis
### Revenue & Growth
### Profitability
### Balance Sheet & Cash Flow
## Competitive Position
## Key Risks
## Valuation Commentary
## Conclusion & Recommendation

Be specific with numbers. Cite sources as [Source: doc title, page N]. Use professional financial language. Include a clear Buy/Hold/Sell stance with reasoning.`;

  const content = await generateText(prompt, { temperature: 0.15, maxOutputTokens: 5000 });

  return {
    companyName: company.name,
    ticker: company.ticker,
    generatedAt: new Date().toISOString(),
    content,
  };
}

/**
 * Generate an executive summary (shorter than full memo, suitable for C-suite).
 */
export async function generateExecutiveSummary(
  orgId: string,
  companyId: string
): Promise<string> {
  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('id, name, ticker')
    .eq('id', companyId)
    .eq('org_id', orgId)
    .single();

  if (!company) throw new Error('Company not found');

  const chunks = await semanticSearch(
    'executive summary key highlights financial performance strategic priorities',
    orgId,
    { companyId, topK: 8, threshold: 0.50 }
  );

  if (!chunks.length) {
    return `No documents indexed for ${company.name}. Upload financial reports to generate an executive summary.`;
  }

  const context = chunks
    .map(c => `[${c.docTitle}, p.${c.pageNumber}]\n${c.content}`)
    .join('\n\n---\n\n');

  const prompt = `You are a C-suite advisor. Write a concise executive summary for ${company.name} based on the available documents. This is for a senior executive — keep it to 3 paragraphs: (1) Business snapshot, (2) Financial highlights, (3) Key strategic priorities and risks.

DOCUMENT CONTEXT:
${context}

Write in clear, direct language. No jargon. Include key metrics.`;

  return generateText(prompt, { temperature: 0.15, maxOutputTokens: 1024 });
}
