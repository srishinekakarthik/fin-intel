import { User, Bot } from 'lucide-react';
import CitationList from '../../components/shared/CitationList';
import type { ChatMessage } from '../../api/chat';

interface Props {
  message: ChatMessage;
}

// Very simple markdown-like renderer: bold, bullet points, line breaks
function renderContent(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bullet points
    if (line.match(/^[\-\*•]\s/)) {
      return (
        <li key={i} className="ml-4 list-disc">
          <span dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
        </li>
      );
    }
    // Empty line = spacing
    if (!line.trim()) return <div key={i} className="h-2" />;
    // Regular line
    return (
      <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
    );
  });
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[Source: (.+?)\]/g, '<span class="text-blue-400 text-xs">[Source: $1]</span>');
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
          isUser ? 'bg-blue-600' : 'bg-gray-700 border border-gray-600'
        }`}
      >
        {isUser
          ? <User size={14} className="text-white" />
          : <Bot size={14} className="text-gray-300" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="space-y-0.5">
              {renderContent(message.content)}
            </div>
          )}
        </div>

        {/* Citations — only for assistant messages */}
        {!isUser && message.citations.length > 0 && (
          <div className="w-full mt-1">
            <CitationList citations={message.citations} />
          </div>
        )}

        <span className="text-gray-600 text-xs mt-1 px-1">
          {new Date(message.created_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
