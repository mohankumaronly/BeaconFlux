import type { Message } from '../types';
import type { StreamProgress } from '../hooks/useChat';
import type { WebSource } from '@local-ollama/shared';
import { MessageBubble } from './MessageBubble';
import { EmptyState } from './EmptyState';
import { useAutoScroll } from '../hooks/useAutoScroll';

export function ChatWindow({
  messages,
  isStreaming,
  onPickSuggestion,
  sources = [],
}: {
  messages: Message[];
  isStreaming: boolean;
  progress: StreamProgress | null;
  onPickSuggestion: (text: string) => void;
  sources?: WebSource[];
}) {
  const lastContent = messages[messages.length - 1]?.content ?? '';
  const scrollRef = useAutoScroll<HTMLDivElement>(
    `${messages.length}:${lastContent.length}`,
  );

  return (
    // flex-1 allows it to fill the left column. items-center centers the max-w-3xl inside.
    <div ref={scrollRef} className="flex-1 w-full overflow-y-auto flex flex-col items-center">
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center w-full">
          <EmptyState onPick={onPickSuggestion} />
        </div>
      ) : (
        <div className="w-full max-w-3xl flex flex-col gap-6 px-4 py-6">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} sources={sources} />
          ))}
          {isStreaming && (
            <div className="flex items-center gap-2 pl-11 text-xs text-gray-400">
              {/* ... existing stats bar ... */}
            </div>
          )}
        </div>
      )}
    </div>
  );
}