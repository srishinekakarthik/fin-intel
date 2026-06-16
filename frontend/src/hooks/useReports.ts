import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi, marketApi } from '../api/reports';
import type { ReportType } from '../types';

// ── Reports ───────────────────────────────────────────────

const REPORTS_KEY = 'reports';

export function useReports(filters?: { report_type?: ReportType; company_id?: string }) {
  return useQuery({
    queryKey: [REPORTS_KEY, filters],
    queryFn: () => reportsApi.list(filters),
  });
}

export function useReport(id: string | null) {
  return useQuery({
    queryKey: [REPORTS_KEY, id],
    queryFn: () => reportsApi.getById(id!),
    enabled: !!id,
    // Poll while report is generating
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string })?.status;
      if (status === 'generating' || status === 'pending') return 3000;
      return false;
    },
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { report_type: ReportType; company_id?: string }) =>
      reportsApi.generate(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [REPORTS_KEY] }),
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reportsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [REPORTS_KEY] }),
  });
}

// ── Market data ───────────────────────────────────────────

const MARKET_KEY = 'market';

export function useStockQuote(ticker: string | null) {
  return useQuery({
    queryKey: [MARKET_KEY, 'quote', ticker],
    queryFn: () => marketApi.getQuote(ticker!),
    enabled: !!ticker,
    staleTime: 60_000, // 1 min — quotes are live data
    refetchInterval: 60_000,
  });
}

export function useCompanyFinancials(ticker: string | null) {
  return useQuery({
    queryKey: [MARKET_KEY, 'financials', ticker],
    queryFn: () => marketApi.getFinancials(ticker!),
    enabled: !!ticker,
    staleTime: 3_600_000, // 1 hour — financials don't change often
  });
}

export function useCompanyNews(ticker: string | null) {
  return useQuery({
    queryKey: [MARKET_KEY, 'news', ticker],
    queryFn: () => marketApi.getNews(ticker!),
    enabled: !!ticker,
    staleTime: 300_000, // 5 min
  });
}

export function useCompanySnapshots(companyId: string | null) {
  return useQuery({
    queryKey: [MARKET_KEY, 'snapshots', companyId],
    queryFn: () => marketApi.getSnapshots(companyId!),
    enabled: !!companyId,
  });
}

export function useRefreshMarketData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (companyId: string) => marketApi.refreshSnapshot(companyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MARKET_KEY] });
      qc.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}
