import { supabaseAdmin } from '../config/supabase';
import { generateText } from '../services/gemini';
import { semanticSearch } from '../services/vector-search';
import { logger } from '../config/logger';

export interface HealthScore {
  total: number; // 0–100
  breakdown: {
    revenueGrowth: number;   // 0–20
    profitability: number;   // 0–20
    liquidity: number;       // 0–20
    debtLevels: number;      // 0–20
    riskExposure: number;    // 0–20
  };
  strengths: string[];
  risks: string[];
  reasoning: string;
}

export interface RiskAnalysis {
  companyName: string;
  riskLevel: 'low' | 'medium' | 'high';
  keyRisks: Array<{ risk: string; severity: 'low' | 'medium' | 'high'; citation: string }>;
  mitigations: string[];
  summary: string;
}

export interface CompetitorComparison {
  companies: string[];
  dimensions: Array<{
    dimension: string;
    values: Record<string, string>;
  }>;
  summary: string;
  winner: string | null;
}

/**
 * Analysis Agent
 *
 * Responsibilities:
 * - Generate AI health scores from document content
 * - Perform risk analysis
 * - Detect trends from financial data
 * - Compare competitors using indexed documents
 */
export class AnalysisAgent {
  /**
   * Generate a Financial Health Score (0–100) for a company
   * by reading its indexed documents.
   */
  async generateHealthScore(
    orgId: string,
    companyId: string,
    companyName: string
  ): Promise<HealthScore> {
    // Retrieve relevant financial chunks
    const queries = [
      'revenue growth annual quarterly earnings',
      'net income profit margin EBITDA operating income',
      'cash flow liquidity current ratio working capital',
      'debt liabilities long-term obligations balance sheet',
      'risks uncertainties challenges competition market',
    ];

    const allChunks: string[] = [];
    for (const q of queries) {
      const chunks = await semanticSearch(q, orgId, {
        companyId,
        topK: 4,
        threshold: 0.55,
      });
      allChunks.push(...chunks.map((c) => c.content));
    }

    if (!allChunks.length) {
      return {
        total: 0,
        breakdown: { revenueGrowth: 0, profitability: 0, liquidity: 0, debtLevels: 0, riskExposure: 0 },
        strengths: [],
        risks: ['Insufficient document data to score'],
        reasoning: 'No indexed documents found for this company.',
      };
    }

    const context = [...new Set(allChunks)].slice(0, 20).join('\n\n---\n\n');

    const prompt = `You are a financial analyst. Based on these excerpts from ${companyName}'s financial documents, score the company across 5 dimensions (0–20 each):

1. Revenue Growth (0–20): Is revenue growing? How fast?
2. Profitability (0–20): Net income, margins, EBITDA
3. Liquidity (0–20): Cash position, current ratio, working capital
4. Debt Levels (0–20): Debt load, leverage, obligations (20 = low debt)
5. Risk Exposure (0–20): Market risks, competitive risks, regulatory risks (20 = low risk)

DOCUMENT EXCERPTS:
${context}

Respond ONLY in this exact JSON format, no extra text:
{
  "revenueGrowth": <0-20>,
  "profitability": <0-20>,
  "liquidity": <0-20>,
  "debtLevels": <0-20>,
  "riskExposure": <0-20>,
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "reasoning": "<2-3 sentence explanation of the overall score>"
}`;

    try {
      const raw = await generateText(prompt, { temperature: 0.1 });
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const breakdown = {
        revenueGrowth: Math.min(20, Math.max(0, parsed.revenueGrowth ?? 0)),
        profitability: Math.min(20, Math.max(0, parsed.profitability ?? 0)),
        liquidity: Math.min(20, Math.max(0, parsed.liquidity ?? 0)),
        debtLevels: Math.min(20, Math.max(0, parsed.debtLevels ?? 0)),
        riskExposure: Math.min(20, Math.max(0, parsed.riskExposure ?? 0)),
      };

      const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

      // Persist the score to company_snapshots
      await this.persistHealthScore(companyId, total, breakdown);

      return {
        total,
        breakdown,
        strengths: parsed.strengths ?? [],
        risks: parsed.risks ?? [],
        reasoning: parsed.reasoning ?? '',
      };
    } catch (err) {
      logger.error('Health score generation failed', { companyId, err });
      throw new Error('Failed to generate health score');
    }
  }

  /**
   * Analyze risks from a company's documents.
   */
  async analyzeRisks(
    orgId: string,
    companyId: string,
    companyName: string
  ): Promise<RiskAnalysis> {
    const chunks = await semanticSearch(
      'risk factors uncertainties challenges threats regulatory competition',
      orgId,
      { companyId, topK: 10, threshold: 0.55 }
    );

    if (!chunks.length) {
      return {
        companyName,
        riskLevel: 'medium',
        keyRisks: [],
        mitigations: [],
        summary: 'No risk-related documents found.',
      };
    }

    const context = chunks
      .map((c) => `[${c.docTitle}, p.${c.pageNumber}]\n${c.content}`)
      .join('\n\n---\n\n');

    const prompt = `As a financial risk analyst, analyze the risks for ${companyName} based on these document excerpts.

${context}

Respond ONLY in this JSON format:
{
  "riskLevel": "low|medium|high",
  "keyRisks": [
    { "risk": "<risk description>", "severity": "low|medium|high", "citation": "<doc title, page>" }
  ],
  "mitigations": ["<mitigation 1>", "<mitigation 2>"],
  "summary": "<2-3 sentence risk summary>"
}`;

    try {
      const raw = await generateText(prompt, { temperature: 0.1 });
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return { companyName, ...parsed };
    } catch {
      throw new Error('Failed to analyze risks');
    }
  }

  /**
   * Compare two or more companies using their indexed documents.
   * Used for competitor analysis (Phase 6 full implementation, Phase 4 preview).
   */
  async compareCompanies(
    orgId: string,
    companies: Array<{ id: string; name: string }>
  ): Promise<CompetitorComparison> {

    // Retrieve context for each company
    const companyContexts: Record<string, string> = {};
    for (const company of companies) {
      const chunks = await semanticSearch(
        'revenue profit strategy competitive market performance',
        orgId,
        { companyId: company.id, topK: 6, threshold: 0.50 }
      );
      companyContexts[company.name] = chunks.map((c) => c.content).join('\n\n') || 'No documents available.';
    }

    const contextBlock = Object.entries(companyContexts)
      .map(([name, ctx]) => `=== ${name} ===\n${ctx}`)
      .join('\n\n');

    const names = companies.map((c) => c.name).join(' vs ');
    const prompt = `Compare ${names} based on their financial documents.

${contextBlock}

Respond ONLY in this JSON format:
{
  "dimensions": [
    {
      "dimension": "<dimension name>",
      "values": { "${companies[0]?.name}": "<assessment>", "${companies[1]?.name}": "<assessment>" }
    }
  ],
  "summary": "<3-4 sentence comparative summary>",
  "winner": "<company name with overall edge, or null if unclear>"
}`;

    try {
      const raw = await generateText(prompt, { temperature: 0.1, maxOutputTokens: 3000 });
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        companies: companies.map((c) => c.name),
        ...parsed,
      };
    } catch {
      throw new Error('Failed to compare companies');
    }
  }

  // ── Private helpers ──────────────────────────────────────

  private async persistHealthScore(
    companyId: string,
    total: number,
    breakdown: HealthScore['breakdown']
  ): Promise<void> {
    await supabaseAdmin.from('company_snapshots').insert({
      company_id: companyId,
      health_score: total,
      score_detail: breakdown,
    });
  }
}

export const analysisAgent = new AnalysisAgent();
