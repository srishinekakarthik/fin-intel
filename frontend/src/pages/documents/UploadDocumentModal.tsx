import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, AlertCircle } from 'lucide-react';
import { useUploadDocument } from '../../hooks/useDocuments';
import { useCompanies } from '../../hooks/useCompanies';
import type { DocType } from '../../types';

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: 'annual_report', label: 'Annual Report' },
  { value: 'quarterly_report', label: 'Quarterly Report' },
  { value: 'financial_statement', label: 'Financial Statement' },
  { value: 'investor_presentation', label: 'Investor Presentation' },
  { value: 'earnings_transcript', label: 'Earnings Call Transcript' },
  { value: 'sec_filing', label: 'SEC Filing' },
  { value: 'other', label: 'Other' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  onClose: () => void;
  defaultCompanyId?: string;
}

export default function UploadDocumentModal({ onClose, defaultCompanyId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [form, setForm] = useState({
    title: '',
    doc_type: 'annual_report' as DocType,
    company_id: defaultCompanyId ?? '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument();
  const { data: companies } = useCompanies({ limit: 100 });

  const handleFile = (f: File) => {
    if (f.type !== 'application/pdf') return;
    setFile(f);
    // Auto-fill title from filename if empty
    if (!form.title) {
      setForm((prev) => ({
        ...prev,
        title: f.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '),
      }));
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    upload.mutate(
      {
        file,
        title: form.title,
        doc_type: form.doc_type,
        company_id: form.company_id || undefined,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-white text-base font-semibold">Upload document</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {upload.isError && (
            <div className="flex gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">
                {(upload.error as Error)?.message ?? 'Upload failed. Please try again.'}
              </p>
            </div>
          )}

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
              isDragging
                ? 'border-blue-500 bg-blue-500/5'
                : file
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-gray-700 hover:border-gray-600'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText size={20} className="text-emerald-400" />
                <div className="text-left">
                  <p className="text-gray-200 text-sm font-medium">{file.name}</p>
                  <p className="text-gray-500 text-xs">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="ml-2 text-gray-600 hover:text-gray-400"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={24} className="text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm font-medium">
                  {isDragging ? 'Drop the PDF here' : 'Drop a PDF here or click to browse'}
                </p>
                <p className="text-gray-600 text-xs mt-1">PDF only · Max 50 MB</p>
              </>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">
              Document title <span className="text-red-400">*</span>
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              placeholder="NVIDIA Annual Report 2024"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Document type */}
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Document type</label>
              <select
                value={form.doc_type}
                onChange={(e) => setForm((f) => ({ ...f, doc_type: e.target.value as DocType }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Company */}
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Company (optional)</label>
              <select
                value={form.company_id}
                onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">No company</option>
                {companies?.data.map((c: import('../../types').Company) => (
                  <option key={c.id} value={c.id}>
                    {c.ticker ? `${c.ticker} — ` : ''}{c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || !form.title || upload.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {upload.isPending ? 'Uploading…' : 'Upload & index'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
