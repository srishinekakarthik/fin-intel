import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesApi, type CompanyFilters, type CreateCompanyPayload } from '../api/companies';

const COMPANIES_KEY = 'companies';

export function useCompanies(filters?: CompanyFilters) {
  return useQuery({
    queryKey: [COMPANIES_KEY, filters],
    queryFn: () => companiesApi.list(filters),
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: [COMPANIES_KEY, id],
    queryFn: () => companiesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCompanyPayload) => companiesApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [COMPANIES_KEY] }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCompanyPayload> }) =>
      companiesApi.update(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [COMPANIES_KEY] });
      qc.invalidateQueries({ queryKey: [COMPANIES_KEY, id] });
    },
  });
}

export function useToggleTracked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companiesApi.toggleTracked(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [COMPANIES_KEY] }),
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [COMPANIES_KEY] }),
  });
}
