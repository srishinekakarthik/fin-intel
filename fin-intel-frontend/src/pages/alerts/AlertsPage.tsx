import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, FileText, Newspaper, CheckCheck, Trash2,
  ExternalLink, Loader2, ChevronDown, ChevronUp, Filter, BarChart3,
} from 'lucide-react';
import {
  useAlerts, useMarkAlertRead, useMarkAllRead, useDeleteAlert,
} from '../../hooks/useAlerts';
import type { Alert, AlertType } from '../../api/alerts';
import clsx from 'clsx';

const ALERT_TYPE_CONFIG: Record<AlertType, { label: string; color: string; icon: React.ElementType }> = {
  sec_filing: { label: 'SEC Filing', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',    icon: FileText },
  news:       { label: 'News',       color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Newspaper },
  earnings:   { label: 'Earnings',   color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: FileText },
  price_move: { label: 'Price',      color: 'bg-violet-500/10 text-violet-400 border-violet-500/20', icon: Bell },
  custom:     { label: 'Custom',     color: 'bg-gray-500/10 text-gray-400 border-gray-500/20',    icon: Bell },
};

function AlertCard({ alert, onRead, onDelete, onViewReport }: {
  alert: Alert;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onViewReport?: (reportId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = ALERT_TYPE_CONFIG[alert.alert_type] ?? ALERT_TYPE_CONFIG.custom;
  const reportId = (alert.metadata as Record<string, unknown>)?.reportId as string | undefined;

  return (
    <div
      className={clsx(
        'border rounded-xl p-4 transition-colors cursor-pointer',
        alert.is_read ? 'bg-gray-900 border-gray-800' : 'bg-gray-900 border-blue-500/20 ring-1 ring-blue-500/10'
      )}
      onClick={() => { if (!alert.is_read) onRead(alert.id); }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1.5">
          <div className={clsx('w-2 h-2 rounded-full', !alert.is_read ? 'bg-blue-500' : 'bg-transparent')} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                  {cfg.label}
                </span>
                {alert.companies && (
                  <span className="text-gray-500 text-xs">
                    {alert.companies.ticker ?? alert.companies.name}
                  </span>
                )}
                <span className="text-gray-600 text-xs">
                  {new Date(alert.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </span>
              </div>
              <p className={`text-sm font-medium leading-snug ${alert.is_read ? 'text-gray-300' : 'text-white'}`}>
                {alert.title}
              </p>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {alert.source_url && (
                <a href={alert.source_url} target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 text-gray-500 hover:text-blue-400 rounded transition-colors" title="Open source">
                  <ExternalLink size={13} />
                </a>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(alert.id); }}
                className="p-1.5 text-gray-600 hover:text-red-400 rounded transition-colors" title="Delete">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {alert.summary && (
            <div className="mt-2">
              <p className={`text-sm leading-relaxed ${expanded ? '' : 'line-clamp-2'} text-gray-400`}>
                {alert.summary}
              </p>
              {alert.summary.length > 160 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-xs mt-1 transition-colors"
                >
                  {expanded ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> Show more</>}
                </button>
              )}
            </div>
          )}

          {reportId && onViewReport && (
            <button
              onClick={(e) => { e.stopPropagation(); onViewReport(reportId); }}
              className="mt-2.5 inline-flex items-center gap-1.5 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/20 text-blue-400 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <BarChart3 size={12} />
              View Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<AlertType | ''>('');
  const [readFilter, setReadFilter] = useState<'all' | 'unread'>('all');

  const { data, isLoading } = useAlerts({
    alert_type: typeFilter || undefined,
    is_read: readFilter === 'unread' ? false : undefined,
    limit: 50,
  });

  const markRead    = useMarkAlertRead();
  const markAll     = useMarkAllRead();
  const deleteAlert = useDeleteAlert();

  const handleViewReport = (reportId: string) => {
    navigate(`/reports?open=${reportId}`);
  };

  const alerts: Alert[] = data?.data ?? [];
  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-white text-2xl font-semibold">Alerts</h1>
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-0.5">SEC filings, earnings, and financial news</p>
        </div>

        {unreadCount > 0 && (
          <button onClick={() => markAll.mutate()} disabled={markAll.isPending}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-3.5 py-2 rounded-lg transition-colors disabled:opacity-50">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={14} className="text-blue-400" />
          <span className="text-gray-300 text-sm font-medium">Automated monitoring via n8n Cloud</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2 text-xs text-gray-500">
          <div><span className="text-gray-400 font-medium">SEC EDGAR</span> — Daily at 7am UTC · 10-K, 10-Q, 8-K filings</div>
          <div><span className="text-gray-400 font-medium">Financial News</span> — Every 6 hours · AI-summarised headlines</div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1">
          <Filter size={13} className="text-gray-500" />
          <span className="text-gray-500 text-xs">Filter:</span>
        </div>

        {(['all', 'unread'] as const).map((f) => (
          <button key={f} onClick={() => setReadFilter(f)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize',
              readFilter === f ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                               : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300')}>
            {f}
          </button>
        ))}

        <div className="w-px h-4 bg-gray-700" />

        {(['', 'sec_filing', 'news', 'earnings'] as const).map((type) => (
          <button key={type || 'all-types'} onClick={() => setTypeFilter(type)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              typeFilter === type ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                                  : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300')}>
            {type === '' ? 'All types' : ALERT_TYPE_CONFIG[type]?.label ?? type}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="text-blue-500 animate-spin" />
        </div>
      ) : !alerts.length ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl py-16 text-center">
          <Bell size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No alerts yet</p>
          <p className="text-gray-600 text-xs mt-1 max-w-xs mx-auto">
            {readFilter === 'unread' ? 'All caught up — no unread alerts.' : 'Alerts will appear here once the n8n monitoring workflow runs.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert}
              onRead={(id) => markRead.mutate(id)}
              onDelete={(id) => deleteAlert.mutate(id)}
              onViewReport={handleViewReport} />
          ))}
        </div>
      )}

      {data?.total != null && data.total > 0 && (
        <p className="text-gray-600 text-xs mt-4 text-right">
          {data.total} alert{data.total !== 1 ? 's' : ''}{unreadCount > 0 && ` · ${unreadCount} unread`}
        </p>
      )}
    </div>
  );
}
