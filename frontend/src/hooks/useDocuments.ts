import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, type DocumentFilters, type UploadDocumentPayload } from '../api/documents';

const DOCS_KEY = 'documents';

export function useDocuments(filters?: DocumentFilters) {
  return useQuery({
    queryKey: [DOCS_KEY, filters],
    queryFn: () => documentsApi.list(filters),
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: [DOCS_KEY, id],
    queryFn: () => documentsApi.getById(id),
    enabled: !!id,
  });
}

/** Poll document status every 3 seconds until ready or failed */
export function useDocumentStatus(id: string | null, enabled = true) {
  return useQuery({
    queryKey: [DOCS_KEY, 'status', id],
    queryFn: () => documentsApi.getStatus(id!),
    enabled: !!id && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'ready' || status === 'failed') return false;
      return 3000; // poll every 3s while pending/processing
    },
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UploadDocumentPayload) => documentsApi.upload(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [DOCS_KEY] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [DOCS_KEY] }),
  });
}

export function useReprocessDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.reprocess(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [DOCS_KEY, 'status', id] });
      qc.invalidateQueries({ queryKey: [DOCS_KEY] });
    },
  });
}
