import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi, type CreateSessionPayload } from '../api/chat';

const SESSIONS_KEY = 'chat-sessions';
const MESSAGES_KEY = 'chat-messages';

export function useChatSessions(companyId?: string) {
  return useQuery({
    queryKey: [SESSIONS_KEY, companyId],
    queryFn: () => chatApi.listSessions(companyId),
  });
}

export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: [MESSAGES_KEY, sessionId],
    queryFn: () => chatApi.getMessages(sessionId!),
    enabled: !!sessionId,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSessionPayload) => chatApi.createSession(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SESSIONS_KEY] }),
  });
}

export function useSendMessage(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => chatApi.sendMessage(sessionId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MESSAGES_KEY, sessionId] });
      qc.invalidateQueries({ queryKey: [SESSIONS_KEY] });
    },
  });
}

export function useArchiveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => chatApi.archiveSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SESSIONS_KEY] }),
  });
}

export function useGenerateHealthScore() {
  return useMutation({
    mutationFn: ({ companyId, companyName }: { companyId: string; companyName: string }) =>
      chatApi.generateHealthScore(companyId, companyName),
  });
}

export function useAnalyzeRisks() {
  return useMutation({
    mutationFn: ({ companyId, companyName }: { companyId: string; companyName: string }) =>
      chatApi.analyzeRisks(companyId, companyName),
  });
}
