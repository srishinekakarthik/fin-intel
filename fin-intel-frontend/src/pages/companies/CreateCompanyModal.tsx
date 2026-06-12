import { useState } from 'react';
import { X } from 'lucide-react';
import { useCreateCompany } from '../../hooks/useCompanies';

const SECTORS = [
  'Technology', 'Healthcare', 'Financial Services', 'Consumer Discretionary',
  'Industrials', 'Energy', 'Materials', 'Real Estate', 'Utilities',
  'Communication Services', 'Consumer Staples',
];

const EXCHANGES = ['NYSE', 'NASDAQ', 'LSE', 'TSX', 'ASX', 'Other'];

interface Props {
  onClose: () => void;
}

export default function CreateCompanyModal({ onClose }: Props) {
  const [form, setForm] = useState({
    name: '',
    ticker: '',
    exchange: '',
    sector: '',
    industry: '',
    website: '',
    is_public: true,
  });

  const createCompany = useCreateCompany();

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCompany.mutate(
      { ...form, ticker: form.ticker || undefined, exchange: form.exchange || undefined, sector: form.sector || undefined },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-white text-base font-semibold">Add company</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {createCompany.isError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">
                {(createCompany.error as Error)?.message ?? 'Failed to create company'}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">
              Company name <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={set('name')}
              required
              placeholder="NVIDIA Corporation"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Ticker symbol</label>
              <input
                value={form.ticker}
                onChange={set('ticker')}
                placeholder="NVDA"
                maxLength={10}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 text-sm uppercase focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Exchange</label>
              <select
                value={form.exchange}
                onChange={set('exchange')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Select…</option>
                {EXCHANGES.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Sector</label>
            <select
              value={form.sector}
              onChange={set('sector')}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">Select sector…</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Industry</label>
            <input
              value={form.industry}
              onChange={set('industry')}
              placeholder="Semiconductors"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Website</label>
            <input
              value={form.website}
              onChange={set('website')}
              type="url"
              placeholder="https://nvidia.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={set('is_public')}
              className="rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300">Publicly listed company</span>
          </label>

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
              disabled={createCompany.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {createCompany.isPending ? 'Creating…' : 'Add company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
