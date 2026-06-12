
import { Link } from 'react-router-dom';
import {
  Building2, FileText, MessageSquare, BarChart3,
  ArrowUpRight, TrendingUp, TrendingDown, RefreshCw, Loader2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCompanies } from '../../hooks/useCompanies';
import { useReports } from '../../hooks/useReports';
import { useRefreshMarketData, useStockQuote } from '../../hooks/useReports';
import { useDocuments } from '../../hooks/useDocuments';
import type { Company } from '../../types';

// ── Stat card ─────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, href, color }: {
  label: string; value: string | number; icon: React.ElementType;
  href: string; color: string;
}) {
  return (
    <Link to={href}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start justify-between hover:border-gray-700 transition-colors group">
      <div>
        <p className="text-gray-500 text-sm mb-1">{label}</p>
        <p className="text-white text-2xl font-semibold">{value}</p>
      </div>
      <div className={`${color} p-2.5 rounded-lg`}>
        <Icon size={18} className="text-white" />
      </div>
    </Link>
  );
}

// ── Live stock ticker row ─────────────────────────────────

function StockRow({ company }: { company: Company }) {
  const { data: quote, isLoading } = useStockQuote(company.ticker);
  const refresh = useRefreshMarketData();

  const snap = company.company_snapshots?.[0];
  const price = quote?.currentPrice ?? snap?.stock_price;
  const change = quote?.changePercent;
  const score = snap?.health_score;
  const isPositive = change != null && change >= 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40 transition-colors rounded-lg group">
      {/* Company identity */}
      <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
        <span className="text-gray-300 text-xs font-mono font-bold">
          {company.ticker?.[0] ?? company.name[0]}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <Link to={`/companies/${company.id}`}
          className="text-gray-200 text-sm font-medium hover:text-blue-400 transition-colors truncate block">
          {company.name}
        </Link>
        {company.ticker && <p className="text-gray-500 text-xs font-mono">{company.ticker}</p>}
      </div>

      {/* Price */}
      <div className="text-right w-20">
        {isLoading ? (
          <Loader2 size={12} className="text-gray-600 animate-spin ml-auto" />
        ) : price != null ? (
          <p className="text-gray-200 text-sm font-mono font-medium">
            ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        ) : (
          <p className="text-gray-600 text-xs">—</p>
        )}
        {change != null && (
          <p className={`text-xs flex items-center justify-end gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {isPositive ? '+' : ''}{change.toFixed(2)}%
          </p>
        )}
      </div>

      {/* Health score */}
      <div className="w-14 text-right">
        {score != null && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
            score >= 70 ? 'bg-emerald-500/10 text-emerald-400' :
            score >= 40 ? 'bg-amber-500/10 text-amber-400' :
                          'bg-red-500/10 text-red-400'
          }`}>
            {Math.round(score)}
          </span>
        )}
      </div>

      {/* Refresh button */}
      {company.ticker && (
        <button
          onClick={() => refresh.mutate(company.id)}
          disabled={refresh.isPending}
          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-blue-400 p-1 rounded transition-all"
          title="Refresh market data"
        >
          <RefreshCw size={12} className={refresh.isPending ? 'animate-spin' : ''} />
        </button>
      )}
    </div>
  );
}

// ── Recent reports strip ──────────────────────────────────

function RecentReports() {
  const { data } = useReports();
  const reports = data?.data?.slice(0, 4) ?? [];

  const typeColors: Record<string, string> = {
    weekly: 'text-blue-400 bg-blue-500/10',
    monthly: 'text-violet-400 bg-violet-500/10',
    quarterly: 'text-emerald-400 bg-emerald-500/10',
    competitor: 'text-amber-400 bg-amber-500/10',
    custom: 'text-gray-400 bg-gray-500/10',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-sm font-medium">Recent reports</h2>
        <Link to="/reports" className="text-blue-400 text-xs hover:text-blue-300 flex items-center gap-1">
          View all <ArrowUpRight size={12} />
        </Link>
      </div>

      {!reports.length ? (
        <div className="text-center py-6">
          <BarChart3 size={24} className="text-gray-700 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No reports yet</p>
          <Link to="/reports" className="text-blue-400 text-xs hover:underline mt-1 inline-block">
            Generate your first report
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report: import('../../types').Report) => (
            <Link key={report.id} to="/reports"
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors group">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeColors[report.report_type] ?? typeColors.custom}`}>
                {report.report_type}
              </span>
              <p className="text-gray-300 text-sm truncate flex-1">{report.title}</p>
              <ArrowUpRight size={12} className="text-gray-600 group-hover:text-gray-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────

export default function DashboardPage() {
  const { user, organization } = useAuth();
  const { data: companies } = useCompanies({ limit: 8, is_tracked: true });
  const { data: documents } = useDocuments({ limit: 1 });
  const { data: reports } = useReports();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const readyDocs  = documents?.total ?? '—';
  const totalReports = reports?.total ?? '—';

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-white text-2xl font-semibold">
          {greeting()}, {user?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {organization?.name} · Financial Intelligence Dashboard
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tracked companies" value={companies?.total ?? '—'} icon={Building2} href="/companies" color="bg-blue-600" />
        <StatCard label="Indexed documents" value={readyDocs} icon={FileText} href="/documents" color="bg-violet-600" />
        <StatCard label="Reports generated" value={totalReports} icon={BarChart3} href="/reports" color="bg-emerald-600" />
        <StatCard label="AI conversations" value="—" icon={MessageSquare} href="/chat" color="bg-amber-600" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Market tracker — 2 cols */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white text-sm font-medium">Market tracker</h2>
              <p className="text-gray-500 text-xs mt-0.5">Live prices via Finnhub · refreshes every 60s</p>
            </div>
            <Link to="/companies" className="text-blue-400 text-xs hover:text-blue-300 flex items-center gap-1">
              Manage <ArrowUpRight size={12} />
            </Link>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 mb-1">
            <div className="w-8" />
            <div className="flex-1 text-gray-600 text-xs uppercase tracking-wide">Company</div>
            <div className="w-20 text-right text-gray-600 text-xs uppercase tracking-wide">Price</div>
            <div className="w-14 text-right text-gray-600 text-xs uppercase tracking-wide">Score</div>
            <div className="w-6" />
          </div>

          {!companies?.data.length ? (
            <div className="text-center py-10">
              <Building2 size={28} className="text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No tracked companies</p>
              <Link to="/companies?new=1" className="text-blue-400 text-xs hover:underline mt-1 inline-block">
                Add a company
              </Link>
            </div>
          ) : (
            <div>
              {companies.data.map((company: Company) => (
                <StockRow key={company.id} company={company} />
              ))}
            </div>
          )}
        </div>

        {/* Right col */}
        <div className="space-y-6">
          <RecentReports />

          {/* Quick actions */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-white text-sm font-medium mb-3">Quick actions</h2>
            <div className="space-y-1.5">
              {[
                { label: 'Generate a weekly report', href: '/reports?generate=1', icon: BarChart3 },
                { label: 'Ask the AI assistant', href: '/chat', icon: MessageSquare },
                { label: 'Upload a document', href: '/documents?upload=1', icon: FileText },
                { label: 'Track a new company', href: '/companies?new=1', icon: Building2 },
              ].map(({ label, href, icon: Icon }) => (
                <Link key={href} to={href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors group">
                  <Icon size={14} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
                  <span className="text-gray-300 text-sm">{label}</span>
                  <ArrowUpRight size={11} className="text-gray-600 ml-auto group-hover:text-gray-400" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
