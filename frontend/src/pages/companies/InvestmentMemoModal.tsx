import { useEffect } from 'react';
import { X, Loader2, FileBarChart, Download } from 'lucide-react';
import { useGenerateMemo } from '../../hooks/useAlerts';

interface Props {
  companyId: string;
  companyName: string;
  onClose: () => void;
}

function renderMarkdown(content: string) {
  return content.split('\n').map((line, i) => {
    if (line.startsWith('# '))   return <h1 key={i} className="text-white text-xl font-bold mt-0 mb-1">{line.slice(2)}</h1>;
    if (line.startsWith('## '))  return <h2 key={i} className="text-gray-100 text-base font-semibold mt-5 mb-2 border-b border-gray-800 pb-1">{line.slice(3)}</h2>;
    if (line.startsWith('### ')) return <h3 key={i} className="text-gray-200 text-sm font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      return <p key={i} className="text-gray-500 text-xs italic mb-3">{line.slice(1, -1)}</p>;
    }
    if (line.match(/^[\-\*]\s/)) return <li key={i} className="text-gray-300 text-sm ml-4 list-disc">{line.slice(2)}</li>;
    if (!line.trim()) return <div key={i} className="h-2" />;

    // Bold inline
    const parts = line.split(/(\*\*.+?\*\*)/g);
    return (
      <p key={i} className="text-gray-300 text-sm leading-relaxed">
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} className="text-gray-100">{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    );
  });
}

export default function InvestmentMemoModal({ companyId, companyName, onClose }: Props) {
  const generate = useGenerateMemo();

  useEffect(() => {
    generate.mutate(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleDownload = () => {
    if (!generate.data) return;
    const blob = new Blob([generate.data.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyName.replace(/\s+/g, '_')}_Investment_Memo.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileBarChart size={16} className="text-blue-400" />
            <h2 className="text-white text-sm font-semibold">Investment Memo — {companyName}</h2>
          </div>
          <div className="flex items-center gap-2">
            {generate.data && (
              <button onClick={handleDownload}
                className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                <Download size={13} /> Download
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {generate.isPending ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 size={32} className="text-blue-500 animate-spin" />
              <p className="text-gray-400 text-sm">Generating investment memo with Gemini…</p>
              <p className="text-gray-600 text-xs">Analyzing financials, risks, strategy, and outlook</p>
            </div>
          ) : generate.isError ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-red-400 text-sm">
                {(generate.error as Error)?.message ?? 'Failed to generate memo'}
              </p>
              <button onClick={() => generate.mutate(companyId)}
                className="text-blue-400 text-sm hover:underline">
                Try again
              </button>
            </div>
          ) : generate.data ? (
            <div className="space-y-0.5">
              {renderMarkdown(generate.data.content)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
