import { supabaseAdmin } from '../config/supabase';
import { generateText } from '../services/gemini';
import { semanticSearch } from '../services/vector-search';
import { logger } from '../config/logger';

export interface CompanyResearchResult {
  companyId: string;
  companyName: string;
  ticker: string | null;
  documentSummary: string;
  keyTopics: string[];
  latestSnapshot: Record<string, unknown> | null;
  documentCount: number;
}

/**
 * Research Agent
 *
 * Responsibilities:
 * - Gather available documents for a company within the org
 * - Extract key topics and themes from indexed chunks
 * - Pull latest market snapshot data
 * - Produce a structured research brief used by the Analysis Agent
 */
export class ResearchAgent {
  /**
   * Build a research brief for a company.
   * Used as context enrichment before analysis or chat.
   */
  async researchCompany(
    orgId: string,
    companyId: string
  ): Promise<CompanyResearchResult> {
    // 1. Fetch company record
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('id, name, ticker, sector, industry')
      .eq('id', companyId)
      .eq('org_id', orgId)
      .single();

    if (!company) throw new Error(`Company ${companyId} not found`);

    // 2. Count indexed documents
    const { count: docCount } = await supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('org_id', orgId)
      .eq('status', 'ready');

    // 3. Retrieve a broad sample of chunks for topic extraction
    const chunks = await semanticSearch(
      `${company.name} business overview financial performance revenue strategy risks`,
      orgId,
      { companyId, topK: 12, threshold: 0.50 }
    );

    // 4. Extract key topics using Gemini
    let documentSummary = 'No documents indexed yet.';
    let keyTopics: string[] = [];

    if (chunks.length > 0) {
      const contextText = chunks.map((c) => c.content).join('\n\n');
      const topicPrompt = `Based on these excerpts from ${company.name}'s financial documents, provide:
1. A 2-sentence summary of what documents are available and their main themes.
2. A JSON array of 5-8 key topics covered (e.g. ["Revenue Growth", "GPU Market", "AI Strategy"]).

Excerpts:
${contextText}

Respond in this exact format:
SUMMARY: <2 sentence summary>
TOPICS: <JSON array>`;

      try {
        const response = await generateText(topicPrompt, { temperature: 0.1 });
        const summaryMatch = response.match(/SUMMARY:\s*(.+?)(?=TOPICS:|$)/s);
        const topicsMatch = response.match(/TOPICS:\s*(\[.+?\])/s);

        if (summaryMatch?.[1]) documentSummary = summaryMatch[1].trim();
        if (topicsMatch?.[1]) {
          keyTopics = JSON.parse(topicsMatch[1]);
        }
      } catch (err) {
        logger.warn('Research agent topic extraction failed', { companyId, err });
        documentSummary = `${docCount ?? 0} documents indexed for ${company.name}.`;
      }
    }

    // 5. Get latest market snapshot
    const { data: snapshot } = await supabaseAdmin
      .from('company_snapshots')
      .select('stock_price, market_cap, health_score, score_detail, snapshot_at')
      .eq('company_id', companyId)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    return {
      companyId: company.id,
      companyName: company.name,
      ticker: company.ticker,
      documentSummary,
      keyTopics,
      latestSnapshot: snapshot ?? null,
      documentCount: docCount ?? 0,
    };
  }
}

export const researchAgent = new ResearchAgent();
