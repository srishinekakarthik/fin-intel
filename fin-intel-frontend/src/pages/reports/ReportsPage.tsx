import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3, Plus, Loader2, CheckCircle2, XCircle,
  Clock, RefreshCw, Trash2, ChevronRight,
} from 'lucide-react';
import { useReports, useGenerateReport, useDeleteReport, useReport } from '../../hooks/useReports';
import { useCompanies } from '../../hooks/useCompanies';
import type { Report, ReportType } from '../../types';

// ── Helpers ───────────────────────────────────────────────

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  competitor: 'Competitor Analysis',
  custom: 'Custom',
};

const REPORT_TYPE_COLORS: Record<ReportType, string> = {
  weekly: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  monthly: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  quarterly: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  competitor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  custom: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'ready')      return <CheckCircle2 size={14} className="text-emerald-400" />;
  if (status === 'failed')     return <XCircle size={14} className="text-red-400" />;
  if (status === 'generating') return <Loader2 size={14} className="text-blue-400 animate-spin" />;
  return <Clock size={14} className="text-gray-500" />;
}

// ── Generate Modal ────────────────────────────────────────

function GenerateReportModal({ onClose }: { onClose: () => void }) {
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [companyId, setCompanyId] = useState('');
  const generate = useGenerateReport();
  const { data: companies } = useCompanies({ limit: 100, is_tracked: true });

  const handleGenerate = () => {
    generate.mutate(
      { report_type: reportType, company_id: companyId || undefined },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md shadow-2xl p-6">
        <h2 className="text-white text-base font-semibold mb-5">Generate report</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Report type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['weekly', 'monthly', 'quarterly', 'competitor', 'custom'] as ReportType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors text-left ${
                    reportType === type
                      ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {REPORT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">
              Company <span className="text-gray-500 text-xs">(optional — leave blank for org-wide)</span>
            </label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">All tracked companies</option>
              {companies?.data.map((c: import('../../types').Company) => (
                <option key={c.id} value={c.id}>
                  {c.ticker ? `${c.ticker} — ` : ''}{c.name}
                </option>
              ))}
            </select>
          </div>

          {generate.isError && (
            <p className="text-red-400 text-sm">
              {(generate.error as Error)?.message ?? 'Failed to start report generation'}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2.5 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generate.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {generate.isPending ? 'Starting…' : 'Generate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Report Viewer ─────────────────────────────────────────

function ReportViewer({ report, onClose }: { report: Report; onClose: () => void }) {
  // Always fetch full report (list query doesn't include content)
  const { data: live, isLoading: isFetching } = useReport(report.id);
  const current = live ?? report;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="min-w-0 flex-1 mr-4">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${REPORT_TYPE_COLORS[current.report_type]}`}>
                {REPORT_TYPE_LABELS[current.report_type]}
              </span>
              <StatusIcon status={current.status} />
            </div>
            <h2 className="text-white text-sm font-semibold truncate">{current.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
            Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isFetching && !live ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 size={32} className="text-blue-500 animate-spin" />
              <p className="text-gray-400 text-sm">Loading report…</p>
            </div>
          ) : current.status === 'generating' || current.status === 'pending' ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 size={32} className="text-blue-500 animate-spin" />
              <p className="text-gray-400 text-sm">Generating report with Gemini AI…</p>
              <p className="text-gray-600 text-xs">This usually takes 15–30 seconds</p>
            </div>
          ) : current.status === 'failed' ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <XCircle size={32} className="text-red-400" />
              <p className="text-gray-400 text-sm">Report generation failed</p>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              {(current.content ?? '').split('\n').map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i} className="text-white text-xl font-bold mt-0 mb-4">{line.slice(2)}</h1>;
                if (line.startsWith('## ')) return <h2 key={i} className="text-gray-100 text-base font-semibold mt-6 mb-2 border-b border-gray-800 pb-1">{line.slice(3)}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-gray-200 text-sm font-semibold mt-4 mb-1">{line.slice(4)}</h3>;
                if (line.match(/^[\-\*]\s/)) return <li key={i} className="text-gray-300 text-sm ml-4 list-disc">{line.slice(2)}</li>;
                if (!line.trim()) return <div key={i} className="h-2" />;
                return <p key={i} className="text-gray-300 text-sm leading-relaxed">{line}</p>;
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-800 flex items-center justify-between">
          <span className="text-gray-600 text-xs">
            Generated {new Date(current.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {current.trigger_source !== 'manual' && ` · ${current.trigger_source}`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Reports Page ─────────────────────────────────────

export default function ReportsPage() {
  const [showGenerate, setShowGenerate] = useState(false);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [typeFilter, setTypeFilter] = useState<ReportType | ''>('');
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, isLoading } = useReports(typeFilter ? { report_type: typeFilter } : undefined);
  const deleteReport = useDeleteReport();

  // Auto-open a report if ?open=<reportId> is present
  const openReportId = searchParams.get('open');
  const { data: linkedReport } = useReport(openReportId && !viewingReport ? openReportId : null);

  useEffect(() => {
    if (linkedReport && openReportId) {
      setViewingReport(linkedReport as Report);
      // Clear the query param so closing/reopening works cleanly
      setSearchParams({}, { replace: true });
    }
  }, [linkedReport, openReportId, setSearchParams]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this report?')) deleteReport.mutate(id);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Reports</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            AI-generated financial intelligence reports
          </p>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Generate report
        </button>
      </div>

      {/* Schedule info banner */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw size={14} className="text-blue-400" />
          <span className="text-gray-300 text-sm font-medium">Automated schedule via n8n Cloud</span>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-2 text-xs text-gray-500">
          <div><span className="text-gray-400 font-medium">Weekly</span> — Every Monday 8am UTC</div>
          <div><span className="text-gray-400 font-medium">Monthly</span> — 1st of each month</div>
          <div><span className="text-gray-400 font-medium">Quarterly</span> — Jan, Apr, Jul, Oct</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['', 'weekly', 'monthly', 'quarterly', 'competitor', 'custom'] as const).map((type) => (
          <button
            key={type || 'all'}
            onClick={() => setTypeFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              typeFilter === type
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
            }`}
          >
            {type === '' ? 'All' : REPORT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Reports table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-gray-800 bg-gray-900/50">
          <div className="flex-1 text-gray-500 text-xs uppercase tracking-wide">Report</div>
          <div className="w-28 text-gray-500 text-xs uppercase tracking-wide">Type</div>
          <div className="w-20 text-gray-500 text-xs uppercase tracking-wide">Status</div>
          <div className="hidden md:block w-36 text-right text-gray-500 text-xs uppercase tracking-wide">Generated</div>
          <div className="w-8" />
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="text-blue-500 mx-auto mb-3 animate-spin" />
            <p className="text-gray-500 text-sm">Loading reports…</p>
          </div>
        ) : !data?.data?.length ? (
          <div className="py-16 text-center">
            <BarChart3 size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">No reports yet</p>
            <p className="text-gray-600 text-xs mt-1">Generate your first report or wait for the scheduled workflow</p>
          </div>
        ) : (
          data.data.map((report: Report) => (
            <div
              key={report.id}
              onClick={() => setViewingReport(report)}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/40 cursor-pointer transition-colors border-b border-gray-800/60 last:border-0 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-gray-100 text-sm font-medium truncate">{report.title}</p>
                {report.companies && (
                  <p className="text-gray-500 text-xs mt-0.5">
                    {report.companies.ticker ?? report.companies.name}
                  </p>
                )}
              </div>

              <div className="w-28">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${REPORT_TYPE_COLORS[report.report_type]}`}>
                  {REPORT_TYPE_LABELS[report.report_type]}
                </span>
              </div>

              <div className="w-20 flex items-center gap-1.5">
                <StatusIcon status={report.status} />
                <span className="text-xs text-gray-400 capitalize">{report.status}</span>
              </div>

              <div className="hidden md:block w-36 text-right text-gray-500 text-xs">
                {new Date(report.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight size={14} className="text-gray-500" />
                <button
                  onClick={(e) => handleDelete(report.id, e)}
                  className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {data && data.total > 0 && (
        <p className="text-gray-600 text-xs mt-3 text-right">{data.total} reports</p>
      )}

      {showGenerate && <GenerateReportModal onClose={() => setShowGenerate(false)} />}
      {viewingReport && <ReportViewer report={viewingReport} onClose={() => setViewingReport(null)} />}
    </div>
  );
}
