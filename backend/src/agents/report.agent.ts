import { supabaseAdmin } from '../config/supabase';
import { generateText } from '../services/gemini';
import { semanticSearch } from '../services/vector-search';
import { getCompanyNews } from '../services/market-data';
import { logger } from '../config/logger';

import type { ReportType } from '../types';

export interface ReportGenerationInput {
  orgId: string;
  reportType: ReportType;
  companyId?: string;         // if scoped to one company
  generatedBy?: string;       // user ID if manual trigger
  triggerSource?: 'manual' | 'scheduled' | 'n8n';
}

/**
 * Report Agent
 *
 * Responsibilities:
 *  - Generate weekly/monthly/quarterly reports from indexed documents + market data
 *  - Generate competitor comparison reports
 *  - Generate executive summaries
 *  - Persist completed reports to the reports table
 */
export class ReportAgent {

  /**
   * Main entry point — dispatches to the right generator by report type.
   */
  async generateReport(input: ReportGenerationInput): Promise<string> {
    // Create the report record (status: generating)
    const { data: report, error } = await supabaseAdmin
      .from('reports')
      .insert({
        org_id: input.orgId,
        generated_by: input.generatedBy ?? null,
        company_id: input.companyId ?? null,
        report_type: input.reportType,
        title: this.buildTitle(input.reportType, input.companyId),
        status: 'generating',
        trigger_source: input.triggerSource ?? 'manual',
      })
      .select()
      .single();

    if (error || !report) throw new Error('Failed to create report record');

    try {
      let content: string;

      switch (input.reportType) {
        case 'weekly':
          content = await this.generateWeeklyReport(input.orgId, input.companyId);
          break;
        case 'monthly':
          content = await this.generateMonthlyReport(input.orgId, input.companyId);
          break;
        case 'quarterly':
          content = await this.generateQuarterlyReport(input.orgId, input.companyId);
          break;
        case 'competitor':
          content = await this.generateCompetitorReport(input.orgId);
          break;
        default:
          content = await this.generateCustomReport(input.orgId, input.companyId);
      }

      // Mark ready
      await supabaseAdmin
        .from('reports')
        .update({ content, status: 'ready', updated_at: new Date().toISOString() })
        .eq('id', report.id);

      // Email all users in the org
      try {
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('email')
          .eq('org_id', input.orgId)
          .eq('is_active', true);

        if (users?.length) {
          const htmlContent = `
            <h2>New Report Generated: ${report.title}</h2>
            <p>Your ${input.reportType} report has been successfully generated and is now available in your FinIntel dashboard.</p>
            <hr />
            <div style="white-space: pre-wrap; font-family: sans-serif; line-height: 1.5;">${content}</div>
          `;

          for (const user of users) {
            const emailPayload = {
              to: user.email,
              subject: `FinIntel Report: ${report.title}`,
              html: htmlContent,
            };

            const n8nWebhookUrl = process.env.N8N_EMAIL_WEBHOOK_URL;
            if (n8nWebhookUrl) {
              await fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailPayload),
              });
            } else {
              logger.info('📧 [N8N MOCK EMAIL]', emailPayload);
            }
          }
        }
      } catch (emailErr) {
        logger.error('Failed to email generated report', { reportId: report.id, err: emailErr });
      }

      return report.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await supabaseAdmin
        .from('reports')
        .update({ status: 'failed', metadata: { error: msg } })
        .eq('id', report.id);
      throw err;
    }
  }

  // ── Weekly report ─────────────────────────────────────────

  private async generateWeeklyReport(orgId: string, companyId?: string): Promise<string> {
    const chunks = await semanticSearch(
      'recent developments earnings announcements news performance updates',
      orgId,
      { companyId, topK: 12, threshold: 0.50 }
    );

    const companies = await this.getTrackedCompanies(orgId, companyId);
    const newsSection = await this.buildNewsSection(companies);
    const docContext = chunks.map(c => `[${c.docTitle}, p.${c.pageNumber}]\n${c.content}`).join('\n\n---\n\n');

    const prompt = `Generate a professional Weekly Financial Intelligence Report for the week ending ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

TRACKED COMPANIES: ${companies.map(c => c.name + (c.ticker ? ` (${c.ticker})` : '')).join(', ')}

DOCUMENT CONTEXT:
${docContext || 'No new documents this week.'}

RECENT NEWS:
${newsSection || 'No recent news available.'}

Generate a structured report with these sections:
# Weekly Financial Intelligence Report
## Executive Summary
## Market Developments
## Company Updates
${companies.length > 1 ? '## Notable Highlights\n## Risks to Watch' : '## Key Metrics\n## Risks'}
## Outlook for Next Week

Keep each section concise and factual. Cite document sources where used. Use professional financial language.`;

    return generateText(prompt, { temperature: 0.2, maxOutputTokens: 3000 });
  }

  // ── Monthly report ────────────────────────────────────────

  private async generateMonthlyReport(orgId: string, companyId?: string): Promise<string> {
    const chunks = await semanticSearch(
      'revenue profit financial performance quarterly results strategy growth',
      orgId,
      { companyId, topK: 16, threshold: 0.50 }
    );

    const companies = await this.getTrackedCompanies(orgId, companyId);
    const snapshotsSection = await this.buildSnapshotsSection(companies);
    const docContext = chunks.map(c => `[${c.docTitle}, p.${c.pageNumber}]\n${c.content}`).join('\n\n---\n\n');

    const now = new Date();
    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const prompt = `Generate a professional Monthly Financial Intelligence Report for ${monthName}.

TRACKED COMPANIES: ${companies.map(c => c.name + (c.ticker ? ` (${c.ticker})` : '')).join(', ')}

MARKET DATA SNAPSHOTS:
${snapshotsSection}

DOCUMENT CONTEXT:
${docContext || 'No documents indexed this month.'}

Generate a structured report with these sections:
# Monthly Financial Intelligence Report — ${monthName}
## Executive Summary
## Financial Performance Summary
## Revenue & Profitability Trends
## Competitive Landscape
## Risk Assessment
## Key Takeaways
## Outlook

Be analytical. Include specific numbers where available. Cite document sources.`;

    return generateText(prompt, { temperature: 0.2, maxOutputTokens: 4000 });
  }

  // ── Quarterly report ──────────────────────────────────────

  private async generateQuarterlyReport(orgId: string, companyId?: string): Promise<string> {
    const chunks = await semanticSearch(
      'quarterly earnings guidance revenue growth profit margin strategic outlook future',
      orgId,
      { companyId, topK: 20, threshold: 0.48 }
    );

    const companies = await this.getTrackedCompanies(orgId, companyId);
    const snapshotsSection = await this.buildSnapshotsSection(companies);
    const docContext = chunks.map(c => `[${c.docTitle}, p.${c.pageNumber}]\n${c.content}`).join('\n\n---\n\n');

    const quarter = Math.ceil((new Date().getMonth() + 1) / 3);
    const year = new Date().getFullYear();

    const prompt = `Generate a comprehensive Quarterly Financial Intelligence Report for Q${quarter} ${year}.

TRACKED COMPANIES: ${companies.map(c => c.name + (c.ticker ? ` (${c.ticker})` : '')).join(', ')}

MARKET DATA:
${snapshotsSection}

DOCUMENT CONTEXT (Earnings reports, filings, presentations):
${docContext || 'No quarterly documents indexed yet.'}

Generate a structured report:
# Q${quarter} ${year} Financial Intelligence Report
## Executive Summary
## Quarterly Performance Review
## Earnings Analysis
## Revenue & Margin Trends
## Strategic Developments
## Competitive Position
## Risk Factors
## Management Guidance & Outlook
## Investment Considerations

This is a detailed analytical report. Use specific financials. Cite all document sources.`;

    return generateText(prompt, { temperature: 0.15, maxOutputTokens: 5000 });
  }

  // ── Competitor report ─────────────────────────────────────

  private async generateCompetitorReport(orgId: string): Promise<string> {
    const companies = await this.getTrackedCompanies(orgId);
    if (companies.length < 2) {
      return 'At least two tracked companies are required for competitor analysis.';
    }

    const allChunks: string[] = [];
    for (const company of companies.slice(0, 4)) {
      const chunks = await semanticSearch(
        'revenue market share competitive advantage strategy performance',
        orgId,
        { companyId: company.id, topK: 6, threshold: 0.50 }
      );
      if (chunks.length) {
        allChunks.push(`=== ${company.name} ===\n` + chunks.map(c => c.content).join('\n'));
      }
    }

    const snapshotsSection = await this.buildSnapshotsSection(companies);

    const prompt = `Generate a Competitor Analysis Report comparing: ${companies.map(c => c.name).join(' vs ')}.

MARKET DATA:
${snapshotsSection}

DOCUMENT CONTEXT:
${allChunks.join('\n\n') || 'No comparative documents available.'}

Generate:
# Competitor Analysis Report
## Executive Summary
## Company Overviews
## Head-to-Head Comparison
### Revenue & Growth
### Profitability
### Market Position
### Strategic Initiatives
### Risk Profile
## Competitive Advantage Assessment
## Conclusion & Recommendations

Be objective and data-driven. Highlight key differentiators.`;

    return generateText(prompt, { temperature: 0.2, maxOutputTokens: 4000 });
  }

  // ── Custom report ─────────────────────────────────────────

  private async generateCustomReport(orgId: string, companyId?: string): Promise<string> {
    const chunks = await semanticSearch(
      'financial performance strategy risks opportunities',
      orgId,
      { companyId, topK: 10, threshold: 0.50 }
    );

    const docContext = chunks.map(c => `[${c.docTitle}, p.${c.pageNumber}]\n${c.content}`).join('\n\n---\n\n');

    const prompt = `Generate a Financial Intelligence Summary based on the available documents.

${docContext || 'No documents available.'}

Produce a clear, professional summary covering key financial insights, risks, and opportunities.`;

    return generateText(prompt, { temperature: 0.2, maxOutputTokens: 2000 });
  }

  // ── Private helpers ───────────────────────────────────────

  private async getTrackedCompanies(orgId: string, companyId?: string) {
    let query = supabaseAdmin
      .from('companies')
      .select('id, name, ticker, sector')
      .eq('org_id', orgId)
      .eq('is_tracked', true)
      .order('name');

    if (companyId) query = query.eq('id', companyId);

    const { data } = await query;
    return (data ?? []) as Array<{ id: string; name: string; ticker: string | null; sector: string | null }>;
  }

  private async buildSnapshotsSection(
    companies: Array<{ id: string; name: string; ticker: string | null }>
  ): Promise<string> {
    const lines: string[] = [];

    for (const company of companies) {
      const { data: snap } = await supabaseAdmin
        .from('company_snapshots')
        .select('stock_price, market_cap, health_score, financials, snapshot_at')
        .eq('company_id', company.id)
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .single();

      if (snap) {
        const fin = snap.financials as Record<string, unknown> | null;
        lines.push(
          `${company.name}${company.ticker ? ` (${company.ticker})` : ''}:` +
          (snap.stock_price ? ` Price $${snap.stock_price}` : '') +
          (snap.market_cap ? `, Mkt Cap ${formatMarketCap(Number(snap.market_cap))}` : '') +
          (snap.health_score ? `, Health Score ${snap.health_score}/100` : '') +
          (fin?.changePercent ? `, Change ${fin.changePercent}%` : '')
        );
      } else {
        lines.push(`${company.name}: No market data available`);
      }
    }

    return lines.join('\n');
  }

  private async buildNewsSection(
    companies: Array<{ id: string; name: string; ticker: string | null }>
  ): Promise<string> {
    const newsItems: string[] = [];
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().split('T')[0]!;

    for (const company of companies.filter(c => c.ticker)) {
      const news = await getCompanyNews(company.ticker!, fmt(weekAgo), fmt(today));
      news.slice(0, 3).forEach(n => {
        newsItems.push(`[${company.name}] ${n.headline}`);
      });
    }

    return newsItems.join('\n');
  }

  private buildTitle(reportType: ReportType, _companyId?: string): string {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const labels: Record<ReportType, string> = {
      weekly: `Weekly Intelligence Report — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      monthly: `Monthly Report — ${date}`,
      quarterly: `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()} Quarterly Report`,
      competitor: `Competitor Analysis — ${date}`,
      custom: `Financial Summary — ${date}`,
    };

    return labels[reportType];
  }
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9)  return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6)  return `$${(cap / 1e6).toFixed(1)}M`;
  return `$${cap.toLocaleString()}`;
}

export const reportAgent = new ReportAgent();
