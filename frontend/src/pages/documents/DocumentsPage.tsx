import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Upload, Search, FileText,
  Loader2, Trash2, Download, RefreshCw,
} from 'lucide-react';
import { useDocuments, useDeleteDocument, useReprocessDocument } from '../../hooks/useDocuments';
import UploadDocumentModal from './UploadDocumentModal';
import DocumentStatusBadge from './DocumentStatusBadge';
import type { Document, DocType } from '../../types';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  annual_report: 'Annual Report',
  quarterly_report: 'Quarterly Report',
  financial_statement: 'Financial Statement',
  investor_presentation: 'Investor Presentation',
  earnings_transcript: 'Earnings Transcript',
  sec_filing: 'SEC Filing',
  other: 'Other',
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentRow({ doc, onDelete, onReprocess }: {
  doc: Document;
  onDelete: (id: string) => void;
  onReprocess: (id: string) => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { documentsApi } = await import('../../api/documents');
      const url = await documentsApi.getDownloadUrl(doc.id);
      window.open(url, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/40 transition-colors border-b border-gray-800/60 last:border-0 group">
      {/* Icon */}
      <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
        <FileText size={15} className="text-gray-400" />
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-gray-100 text-sm font-medium truncate">{doc.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-gray-500 text-xs">{DOC_TYPE_LABELS[doc.doc_type]}</span>
          {(doc as Document & { companies?: { name: string; ticker: string | null } }).companies && (
            <span className="text-gray-600 text-xs">
              · {(doc as Document & { companies: { name: string; ticker: string | null } }).companies.ticker
                  ?? (doc as Document & { companies: { name: string; ticker: string | null } }).companies.name}
            </span>
          )}
          {doc.page_count && (
            <span className="text-gray-600 text-xs">· {doc.page_count} pages</span>
          )}
          <span className="text-gray-600 text-xs">· {formatBytes(doc.file_size)}</span>
        </div>
      </div>

      {/* Status */}
      <DocumentStatusBadge documentId={doc.id} initialStatus={doc.status} />

      {/* Date */}
      <span className="hidden lg:block text-gray-600 text-xs w-24 text-right">
        {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {doc.status === 'failed' && (
          <button
            onClick={() => onReprocess(doc.id)}
            className="p-1.5 text-gray-500 hover:text-amber-400 rounded transition-colors"
            title="Retry ingestion"
          >
            <RefreshCw size={14} />
          </button>
        )}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="p-1.5 text-gray-500 hover:text-blue-400 rounded transition-colors disabled:opacity-50"
          title="Download"
        >
          <Download size={14} />
        </button>
        <button
          onClick={() => onDelete(doc.id)}
          className="p-1.5 text-gray-500 hover:text-red-400 rounded transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showUpload, setShowUpload] = useState(searchParams.get('upload') === '1');

  const { data, isLoading } = useDocuments({
    search: search || undefined,
    status: statusFilter || undefined,
  });
  const deleteDoc = useDeleteDocument();
  const reprocess = useReprocessDocument();

  const handleDelete = (id: string) => {
    if (confirm('Delete this document? All associated embeddings and citations will be removed.')) {
      deleteDoc.mutate(id);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Documents</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Upload financial documents for AI-powered analysis
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Upload size={16} />
          Upload PDF
        </button>
      </div>

      {/* How it works banner — show when no docs yet */}
      {!isLoading && !data?.data.length && !search && (
        <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-5 mb-6">
          <h3 className="text-blue-300 text-sm font-medium mb-2">How document intelligence works</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-400">
            {[
              { step: '01', label: 'Upload PDF', desc: 'Annual reports, filings, presentations' },
              { step: '02', label: 'Extract & chunk', desc: 'Text extracted and split by page' },
              { step: '03', label: 'Generate embeddings', desc: 'Gemini text-embedding-004 (768 dims)' },
              { step: '04', label: 'Ask questions', desc: 'RAG search with page-level citations' },
            ].map(({ step, label, desc }) => (
              <div key={step} className="flex gap-2.5">
                <span className="text-blue-500 font-mono font-bold">{step}</span>
                <div>
                  <p className="text-gray-300 font-medium">{label}</p>
                  <p className="text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-gray-600 transition-colors"
        >
          <option value="">All statuses</option>
          <option value="ready">Ready</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-gray-800 bg-gray-900/50">
          <div className="w-8" />
          <div className="flex-1 text-gray-500 text-xs uppercase tracking-wide">Document</div>
          <div className="w-24 text-gray-500 text-xs uppercase tracking-wide">Status</div>
          <div className="hidden lg:block w-24 text-right text-gray-500 text-xs uppercase tracking-wide">Uploaded</div>
          <div className="w-16" />
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="text-blue-500 mx-auto mb-3 animate-spin" />
            <p className="text-gray-500 text-sm">Loading documents…</p>
          </div>
        ) : !data?.data.length ? (
          <div className="py-16 text-center">
            <FileText size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">No documents yet</p>
            <p className="text-gray-600 text-xs mt-1">
              {search ? 'Try a different search term' : 'Upload your first PDF to get started'}
            </p>
          </div>
        ) : (
          <div>
            {data.data.map((doc: import("../../types").Document) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onDelete={handleDelete}
                onReprocess={(id) => reprocess.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      {data && data.total > 0 && (
        <p className="text-gray-600 text-xs mt-3 text-right">
          {data.total} {data.total === 1 ? 'document' : 'documents'}
        </p>
      )}

      {showUpload && (
        <UploadDocumentModal onClose={() => setShowUpload(false)} />
      )}
    </div>
  );
}
