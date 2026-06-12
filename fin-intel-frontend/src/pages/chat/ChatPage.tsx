import { useState } from 'react';

import {
  Plus, MessageSquare, Building2, Trash2, Globe, FileText
} from 'lucide-react';
import { useChatSessions, useCreateSession, useArchiveSession } from '../../hooks/useChat';
import { useCompanies } from '../../hooks/useCompanies';
import ChatWindow from './ChatWindow';
import type { ChatSession } from '../../api/chat';
import clsx from 'clsx';

// ── New Session Modal ─────────────────────────────────────

function NewSessionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (session: ChatSession) => void;
}) {
  const [scope, setScope] = useState<'global' | 'company'>('global');
  const [companyId, setCompanyId] = useState('');
  const { data: companies } = useCompanies({ limit: 100 });
  const createSession = useCreateSession();

  const handleCreate = () => {
    createSession.mutate(
      {
        company_id: scope === 'company' && companyId ? companyId : undefined,
      },
      { onSuccess: (session) => { onCreated(session); onClose(); } }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-sm shadow-2xl p-6">
        <h2 className="text-white text-base font-semibold mb-4">New conversation</h2>

        <p className="text-gray-400 text-sm mb-3">Scope this conversation to:</p>

        <div className="space-y-2 mb-5">
          {[
            {
              value: 'global',
              icon: Globe,
              label: 'All documents',
              desc: 'Search across your entire document library',
            },
            {
              value: 'company',
              icon: Building2,
              label: 'A specific company',
              desc: 'Only use documents belonging to that company',
            },
          ].map(({ value, icon: Icon, label, desc }) => (
            <button
              key={value}
              onClick={() => setScope(value as typeof scope)}
              className={clsx(
                'w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors',
                scope === value
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              )}
            >
              <Icon size={16} className={scope === value ? 'text-blue-400' : 'text-gray-500'} />
              <div>
                <p className={`text-sm font-medium ${scope === value ? 'text-blue-300' : 'text-gray-300'}`}>
                  {label}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {scope === 'company' && (
          <div className="mb-5">
            <label className="block text-sm text-gray-300 mb-1.5">Select company</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">Select a company…</option>
              {companies?.data.map((c: import('../../types').Company) => (
                <option key={c.id} value={c.id}>
                  {c.ticker ? `${c.ticker} — ` : ''}{c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={createSession.isPending || (scope === 'company' && !companyId)}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {createSession.isPending ? 'Creating…' : 'Start chat'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Session item ──────────────────────────────────────────

function SessionItem({
  session,
  active,
  onSelect,
  onArchive,
}: {
  session: ChatSession;
  active: boolean;
  onSelect: () => void;
  onArchive: () => void;
}) {
  return (
    <div
      className={clsx(
        'group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
        active ? 'bg-blue-600/15 border border-blue-500/20' : 'hover:bg-gray-800'
      )}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${active ? 'text-blue-300' : 'text-gray-300'}`}>
          {session.title}
        </p>
        {session.companies && (
          <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
            <Building2 size={10} />
            {session.companies.ticker ?? session.companies.name}
          </p>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onArchive(); }}
        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 p-1 rounded transition-all"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ── Main Chat Page ────────────────────────────────────────

export default function ChatPage() {
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const { data: sessions = [], isLoading } = useChatSessions();
  const archiveSession = useArchiveSession();

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const scope = activeSession?.company_id ? 'company' : 'global';

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-gray-800 flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white text-sm font-semibold">AI Assistant</h2>
          <button
            onClick={() => setShowNewModal(true)}
            className="w-7 h-7 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center transition-colors"
            title="New conversation"
          >
            <Plus size={14} className="text-white" />
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !sessions.length ? (
            <div className="text-center py-8 px-2">
              <MessageSquare size={24} className="text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-xs">No conversations yet</p>
              <button
                onClick={() => setShowNewModal(true)}
                className="text-blue-400 text-xs hover:underline mt-1"
              >
                Start your first chat
              </button>
            </div>
          ) : (
            sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                active={session.id === activeSessionId}
                onSelect={() => setActiveSessionId(session.id)}
                onArchive={() => archiveSession.mutate(session.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeSession ? (
          <ChatWindow session={activeSession} scope={scope} />
        ) : (
          // Welcome screen
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-14 h-14 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-5">
              <span className="text-blue-400 text-2xl">✦</span>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">AI Financial Assistant</h2>
            <p className="text-gray-400 text-sm max-w-sm mb-8">
              Ask questions about your financial documents. Every answer is grounded in your indexed documents with page-level citations.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg mb-8">
              {[
                { icon: Globe, title: 'Global search', desc: 'Ask across all your documents' },
                { icon: Building2, title: 'Company chat', desc: 'Focus on a specific company' },
                { icon: FileText, title: 'Document Q&A', desc: 'Deep-dive a single document' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-left">
                  <Icon size={16} className="text-blue-400 mb-2" />
                  <p className="text-gray-200 text-sm font-medium">{title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              <Plus size={16} />
              New conversation
            </button>
          </div>
        )}
      </div>

      {showNewModal && (
        <NewSessionModal
          onClose={() => setShowNewModal(false)}
          onCreated={(session) => setActiveSessionId(session.id)}
        />
      )}
    </div>
  );
}
