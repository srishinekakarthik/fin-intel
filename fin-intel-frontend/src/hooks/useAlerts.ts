import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi, type AlertType } from '../api/alerts';

const ALERTS_KEY = 'alerts';

export function useAlerts(filters?: {
  alert_type?: AlertType; company_id?: string; is_read?: boolean;
  page?: number; limit?: number;
}) {
  return useQuery({
    queryKey: [ALERTS_KEY, filters],
    queryFn: () => alertsApi.list(filters),
    staleTime: 30_000,
  });
}

export function useUnreadAlertCount() {
  return useQuery({
    queryKey: [ALERTS_KEY, 'unread-count'],
    queryFn: alertsApi.getUnreadCount,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ALERTS_KEY] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: alertsApi.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: [ALERTS_KEY] }),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ALERTS_KEY] }),
  });
}

export function useGenerateMemo() {
  return useMutation({
    mutationFn: (companyId: string) => alertsApi.generateMemo(companyId),
  });
}

export function useGenerateExecutiveSummary() {
  return useMutation({
    mutationFn: (companyId: string) => alertsApi.generateExecutiveSummary(companyId),
  });
}

export function useCompareCompanies() {
  return useMutation({
    mutationFn: (companies: Array<{ id: string; name: string }>) =>
      alertsApi.compareCompanies(companies),
  });
}

export function useSecFilings(ticker: string | null) {
  return useQuery({
    queryKey: ['sec-filings', ticker],
    queryFn: () => alertsApi.getSecFilings(ticker!),
    enabled: !!ticker,
    staleTime: 300_000,
  });
}
