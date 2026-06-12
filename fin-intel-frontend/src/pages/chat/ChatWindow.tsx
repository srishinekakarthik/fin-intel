import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Building2, FileText, Globe } from 'lucide-react';
import { useChatMessages, useSendMessage } from '../../hooks/useChat';
import MessageBubble from './MessageBubble';
import type { ChatSession } from '../../api/chat';

const SUGGESTED_QUESTIONS = {
  company: [
    'What are the biggest risks mentioned in the filings?',
    'Summarize the revenue growth trend.',
    'What is the company\'s AI strategy?',
    'What changed between the latest two reports?',
  ],
  global: [
    'Which companies have the strongest revenue growth?',
    'What are the common risks across tracked companies?',
    'Summarize the latest earnings reports.',
    'Which company has the best financial health?',
  ],
  document: [
    'Give me a summary of this document.',
    'What are the key financial figures?',
    'What risks are highlighted?',
    'What are the main strategic priorities?',
  ],
};

interface Props {
  session: ChatSession;
  scope: 'global' | 'company' | 'document';
}

export default function ChatWindow({ session, scope }: Props) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages = [], isLoading } = useChatMessages(session.id);
  const sendMessage = useSendMessage(session.id);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendMessage.isPending]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMessage.isPending) return;
    setInput('');
    sendMessage.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const scopeIcon = scope === 'company'
    ? <Building2 size={13} />
    : scope === 'document'
    ? <FileText size={13} />
    : <Globe size={13} />;

  const scopeLabel = scope === 'company' && session.companies
    ? `${session.companies.ticker ?? session.companies.name}`
    : scope === 'document'
    ? 'Document Q&A'
    : 'All documents';

  const suggestions = SUGGESTED_QUESTIONS[scope];

  return (
    <div className="flex flex-col h-full">
      {/* Session header */}
      <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-full px-2.5 py-1 text-xs text-gray-400">
          {scopeIcon}
          <span>{scopeLabel}</span>
        </div>
        <span className="text-gray-500 text-sm truncate">{session.title}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="text-gray-600 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          // Empty state with suggested questions
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <div className="w-10 h-10 bg-blue-600/15 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4">
              <span className="text-blue-400 text-lg">✦</span>
            </div>
            <h3 className="text-gray-200 text-sm font-medium mb-1">Ask anything about your documents</h3>
            <p className="text-gray-500 text-xs text-center mb-6 max-w-xs">
              Every answer is grounded in your indexed documents with page-level citations.
            </p>
            <div className="w-full max-w-sm space-y-2">
              {suggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="w-full text-left text-sm text-gray-400 hover:text-gray-200 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-700 rounded-xl px-4 py-2.5 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Loading indicator while waiting for AI */}
            {sendMessage.isPending && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center flex-shrink-0 mt-1">
                  <Loader2 size={14} className="text-gray-400 animate-spin" />
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-5">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error state */}
      {sendMessage.isError && (
        <div className="mx-5 mb-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-xs">
            {(sendMessage.error as Error)?.message ?? 'Failed to get a response. Please try again.'}
          </p>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-3 items-end bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus-within:border-gray-600 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your financial documents…"
            rows={1}
            className="flex-1 bg-transparent text-gray-100 text-sm placeholder-gray-500 resize-none focus:outline-none max-h-32 overflow-y-auto"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className="flex-shrink-0 w-8 h-8 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
        <p className="text-gray-700 text-xs mt-1.5 text-center">
          Answers are grounded in indexed documents. Always verify financial figures.
        </p>
      </div>
    </div>
  );
}
