import { useState } from 'react';
import { X, Loader2, Plus, Trophy } from 'lucide-react';
import { useCompanies } from '../../hooks/useCompanies';
import { useCompareCompanies } from '../../hooks/useAlerts';
import type { Company } from '../../types';

interface Props {
  onClose: () => void;
  initialCompanyId?: string;
}

interface ComparisonResult {
  companies: string[];
  dimensions: Array<{ dimension: string; values: Record<string, string> }>;
  summary: string;
  winner: string | null;
}

export default function CompetitorAnalysisModal({ onClose, initialCompanyId }: Props) {
  const [selected, setSelected] = useState<string[]>(initialCompanyId ? [initialCompanyId] : []);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const { data: companies } = useCompanies({ limit: 100, is_tracked: true });
  const compare = useCompareCompanies();

  const availableCompanies = companies?.data.filter((c: Company) => !selected.includes(c.id)) ?? [];
  const selectedCompanies = selected
    .map((id) => companies?.data.find((c: Company) => c.id === id))
    .filter((c): c is Company => !!c);

  const handleAdd = (id: string) => {
    if (selected.length < 4) setSelected([...selected, id]);
  };

  const handleRemove = (id: string) => {
    setSelected(selected.filter((s) => s !== id));
    setResult(null);
  };

  const handleCompare = () => {
    if (selected.length < 2) return;
    const payload = selectedCompanies.map((c) => ({ id: c.id, name: c.name }));
    compare.mutate(payload, { onSuccess: (data) => setResult(data) });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white text-base font-semibold">Competitor Analysis</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Company selection */}
          <div className="mb-5">
            <label className="block text-sm text-gray-300 mb-2">
              Select 2–4 companies to compare
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedCompanies.map((c) => (
                <span key={c.id} className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm px-3 py-1.5 rounded-lg">
                  {c.ticker ?? c.name}
                  <button onClick={() => handleRemove(c.id)} className="text-blue-400 hover:text-blue-200">
                    <X size={12} />
                  </button>
                </span>
              ))}
              {selected.length === 0 && (
                <span className="text-gray-600 text-sm">No companies selected</span>
              )}
            </div>

            {selected.length < 4 && availableCompanies.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableCompanies.slice(0, 8).map((c: Company) => (
                  <button key={c.id} onClick={() => handleAdd(c.id)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-750 border border-gray-700 px-2.5 py-1 rounded-lg transition-colors">
                    <Plus size={11} />
                    {c.ticker ?? c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleCompare}
            disabled={selected.length < 2 || compare.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors mb-5"
          >
            {compare.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Analyzing with Gemini…
              </span>
            ) : (
              `Compare ${selected.length >= 2 ? selectedCompanies.map(c => c.ticker ?? c.name).join(' vs ') : 'companies'}`
            )}
          </button>

          {compare.isError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
              <p className="text-red-400 text-sm">
                {(compare.error as Error)?.message ?? 'Comparison failed. Make sure companies have indexed documents.'}
              </p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Winner badge */}
              {result.winner && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5">
                  <Trophy size={16} className="text-amber-400" />
                  <span className="text-amber-300 text-sm">
                    <strong>{result.winner}</strong> has the overall edge
                  </span>
                </div>
              )}

              {/* Comparison table */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left text-gray-500 text-xs uppercase tracking-wide px-4 py-2.5">Dimension</th>
                      {result.companies.map((name) => (
                        <th key={name} className="text-left text-gray-300 text-xs font-medium px-4 py-2.5">{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.dimensions.map((dim, i) => (
                      <tr key={i} className="border-b border-gray-800 last:border-0">
                        <td className="text-gray-400 text-xs font-medium px-4 py-3 align-top">{dim.dimension}</td>
                        {result.companies.map((name) => (
                          <td key={name} className="text-gray-300 text-xs px-4 py-3 align-top leading-relaxed">
                            {dim.values[name] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Summary</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{result.summary}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
