import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { Citation } from '../../types';

interface Props {
  citations: Citation[];
}

export default function CitationList({ citations }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!citations.length) return null;

  const visible = expanded ? citations : citations.slice(0, 2);

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-gray-600 text-xs uppercase tracking-wide font-medium">
        Sources ({citations.length})
      </p>
      {visible.map((cite, i) => (
        <div
          key={i}
          className="flex items-start gap-2 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2"
        >
          <FileText size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-gray-300 text-xs font-medium truncate">{cite.doc_title}</p>
            <p className="text-gray-500 text-xs">Page {cite.page}</p>
            {cite.excerpt && (
              <p className="text-gray-500 text-xs mt-1 line-clamp-2 italic">
                "{cite.excerpt}"
              </p>
            )}
          </div>
        </div>
      ))}
      {citations.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-xs transition-colors"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Show less' : `Show ${citations.length - 2} more sources`}
        </button>
      )}
    </div>
  );
}
