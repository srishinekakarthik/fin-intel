import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, Star, StarOff, Trash2 } from 'lucide-react';
import { useCompanies, useToggleTracked, useDeleteCompany } from '../../hooks/useCompanies';
import type { Company } from '../../types';
import CreateCompanyModal from './CreateCompanyModal';

function HealthBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-gray-600 text-xs">No score</span>;
  const color =
    score >= 70 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
    score >= 40 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                  'bg-red-500/10 text-red-400 border-red-500/20';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
      {Math.round(score)}/100
    </span>
  );
}

function CompanyRow({ company, onToggle, onDelete }: {
  company: Company;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const snap = company.company_snapshots?.[0];

  return (
    <div 
      onClick={() => navigate(`/companies/${company.id}`)}
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/50 transition-colors group border-b border-gray-800/60 last:border-0 cursor-pointer"
    >
      {/* Company identity */}
      <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
        <span className="text-gray-300 text-xs font-mono font-medium">
          {company.ticker?.[0] ?? company.name[0]}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <Link
          to={`/companies/${company.id}`}
          className="text-gray-100 text-sm font-medium hover:text-blue-400 transition-colors"
        >
          {company.name}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          {company.ticker && (
            <span className="text-gray-500 text-xs font-mono">{company.ticker}</span>
          )}
          {company.exchange && (
            <span className="text-gray-600 text-xs">{company.exchange}</span>
          )}
          {company.sector && (
            <span className="text-gray-600 text-xs">· {company.sector}</span>
          )}
        </div>
      </div>

      {/* Stock price */}
      <div className="hidden md:block w-24 text-right">
        {snap?.stock_price != null ? (
          <span className="text-gray-200 text-sm font-mono">
            ${snap.stock_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </div>

      {/* Market cap */}
      <div className="hidden lg:block w-24 text-right">
        {snap?.market_cap != null ? (
          <span className="text-gray-400 text-xs">
            {formatMarketCap(snap.market_cap)}
          </span>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </div>

      {/* Health score */}
      <div className="w-20 flex justify-end">
        <HealthBadge score={snap?.health_score} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(company.id); }}
          className="p-1.5 text-gray-500 hover:text-amber-400 rounded transition-colors"
          title={company.is_tracked ? 'Untrack' : 'Track'}
        >
          {company.is_tracked ? <StarOff size={14} /> : <Star size={14} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(company.id); }}
          className="p-1.5 text-gray-500 hover:text-red-400 rounded transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(1)}M`;
  return `$${cap.toLocaleString()}`;
}

export default function CompaniesPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(searchParams.get('new') === '1');

  const { data, isLoading } = useCompanies({ search: search || undefined });
  const toggleTracked = useToggleTracked();
  const deleteCompany = useDeleteCompany();

  const handleDelete = (id: string) => {
    if (confirm('Delete this company? This will also remove all associated documents and data.')) {
      deleteCompany.mutate(id);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Companies</h1>
          <p className="text-gray-400 text-sm mt-0.5">Track and analyze companies</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add company
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or ticker…"
          className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-gray-800 bg-gray-900/50">
          <div className="w-8" />
          <div className="flex-1 text-gray-500 text-xs uppercase tracking-wide">Company</div>
          <div className="hidden md:block w-24 text-right text-gray-500 text-xs uppercase tracking-wide">Price</div>
          <div className="hidden lg:block w-24 text-right text-gray-500 text-xs uppercase tracking-wide">Mkt Cap</div>
          <div className="w-20 text-right text-gray-500 text-xs uppercase tracking-wide">Score</div>
          <div className="w-16" />
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading companies…</p>
          </div>
        ) : !data?.data.length ? (
          <div className="py-16 text-center">
            <Building2 size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">No companies found</p>
            <p className="text-gray-600 text-xs mt-1">
              {search ? 'Try a different search term' : 'Add your first company to get started'}
            </p>
          </div>
        ) : (
          <div>
            {data.data.map((company: import("../../types").Company) => (
              <CompanyRow
                key={company.id}
                company={company}
                onToggle={(id) => toggleTracked.mutate(id)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {data && data.total > 0 && (
        <p className="text-gray-600 text-xs mt-3 text-right">
          {data.total} {data.total === 1 ? 'company' : 'companies'}
        </p>
      )}

      {showModal && <CreateCompanyModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
