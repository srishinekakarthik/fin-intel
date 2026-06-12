import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { useDocumentStatus } from '../../hooks/useDocuments';

interface Props {
  documentId: string;
  initialStatus: string;
}

export default function DocumentStatusBadge({ documentId, initialStatus }: Props) {
  // Only poll if the document is in a transitional state
  const shouldPoll = initialStatus === 'pending' || initialStatus === 'processing';

  const { data: statusData } = useDocumentStatus(
    shouldPoll ? documentId : null,
    shouldPoll
  );

  const status = statusData?.status ?? initialStatus;

  if (status === 'ready') {
    return (
      <div className="flex items-center gap-1.5 text-emerald-400">
        <CheckCircle2 size={14} />
        <span className="text-xs font-medium">Ready</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-1.5 text-red-400">
        <XCircle size={14} />
        <span className="text-xs font-medium">Failed</span>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="flex items-center gap-1.5 text-blue-400">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-xs font-medium">Indexing…</span>
      </div>
    );
  }

  // pending
  return (
    <div className="flex items-center gap-1.5 text-gray-500">
      <Clock size={14} />
      <span className="text-xs font-medium">Pending</span>
    </div>
  );
}
