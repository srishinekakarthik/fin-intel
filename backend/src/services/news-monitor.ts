import { supabaseAdmin } from '../config/supabase';
import { getCompanyNews } from './market-data';
import { generateText } from './gemini';
import { logger } from '../config/logger';

/**
 * Monitor financial news for all tracked companies in an org.
 * Creates alert records for significant news items.
 * Called by n8n on a schedule (every 6 hours).
 */
export async function monitorCompanyNews(orgId: string): Promise<number> {
  const { data: companies } = await supabaseAdmin
    .from('companies')
    .select('id, name, ticker')
    .eq('org_id', orgId)
    .eq('is_tracked', true)
    .not('ticker', 'is', null);

  if (!companies?.length) return 0;

  let alertsCreated = 0;
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().split('T')[0]!;

  for (const company of companies) {
    if (!company.ticker) continue;

    try {
      const news = await getCompanyNews(company.ticker, fmt(yesterday), fmt(today));
      if (!news.length) continue;

      // Take top 3 most recent articles
      const topNews = news.slice(0, 3);

      for (const article of topNews) {
        // Deduplicate by URL
        const { data: existing } = await supabaseAdmin
          .from('alerts')
          .select('id')
          .eq('org_id', orgId)
          .eq('company_id', company.id)
          .eq('alert_type', 'news')
          .contains('metadata', { url: article.url })
          .single();

        if (existing) continue;

        // Generate a 1-sentence AI summary
        let summary = article.summary?.slice(0, 300) ?? article.headline;
        if (article.summary && article.summary.length > 100) {
          try {
            summary = await generateText(
              `Summarize this financial news in one sentence for a financial analyst: "${article.headline}. ${article.summary}"`,
              { temperature: 0.1, maxOutputTokens: 128 }
            );
          } catch { /* use raw summary */ }
        }

        await supabaseAdmin.from('alerts').insert({
          org_id: orgId,
          company_id: company.id,
          alert_type: 'news',
          title: article.headline,
          summary,
          source_url: article.url,
          metadata: {
            url: article.url,
            source: article.source,
            datetime: article.datetime,
            ticker: company.ticker,
          },
        });

        alertsCreated++;
      }
    } catch (err) {
      logger.warn('News monitoring failed', { companyId: company.id, err });
    }
  }

  return alertsCreated;
}
