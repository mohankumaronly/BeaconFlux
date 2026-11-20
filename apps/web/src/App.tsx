import { useCallback, useEffect, useState } from 'react';
import { useConnection } from './hooks/useConnection';
import { useChat } from './hooks/useChat';
import { useTheme } from './hooks/useTheme';
import { useChats } from './hooks/useChats';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { Composer } from './components/Composer';
import { ThemeToggle } from './components/ThemeToggle';
import { SettingsModal } from './components/SettingsModal';
import { FirstRunModal } from './components/FirstRunModal';
import { SourcesPanel } from './components/SourcesPanel';
import { ProviderBadge } from './components/ProviderBadge';
import { useProviderSelection } from './hooks/useProviders';
import { Settings, Check, AlertCircle, Search } from 'lucide-react';
import {
  hasApiToken,
  getStoredToken,
  verifyToken,
} from './lib/api';

const DEFAULT_MODEL = 'llama3.2';

interface ToastState {
  message: string;
  type?: 'info' | 'success' | 'warn' | 'error';
}

const App = () => {
  const { theme, toggle } = useTheme();
  const {
    baseUrl,
    status,
    models,
    loadingModels,
    setEndpoint,
    retry,
    reset,
  } = useConnection();

  const { currentId: providerId, current: currentProvider, setCurrentId, providers } = useProviderSelection();
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [firstRunOpen, setFirstRunOpen] = useState(() => !hasApiToken());
  const [showTokenBanner, setShowTokenBanner] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (currentProvider?.defaultModel) setSelectedModel(currentProvider.defaultModel);
  }, [currentProvider?.id, currentProvider?.defaultModel]);

  const fallbackModel = (() => {
    if (models.length === 0) return selectedModel;
    const preferred = models.find((m) => /^llama/i.test(m.name));
    return (preferred ?? models[0]).name;
  })();
  const model =
    models.length > 0 && !models.some((m) => m.name === selectedModel)
      ? fallbackModel
      : selectedModel;

  const {
    messages, chatId, isStreaming, progress, error, send, stop, clear, loadChat, currentSources
  } = useChat({
    model,
    ollamaUrl: baseUrl,
    providerId,
    onChatCreated: (chat) => handleChatCreated(chat),
  });

  const handleToast = useCallback(
    (message: string, type?: 'info' | 'success' | 'warn' | 'error') => {
      setToast({ message, type });
    },
    [],
  );

  const { chats, prependChat, rename, pin, remove, download, refresh } = useChats({
    isStreaming,
    onToast: handleToast,
  });

  const handleChatCreated = useCallback(
    (chat: { id: number; title: string }) => {
      const now = new Date().toISOString();
      prependChat({
        id: chat.id,
        title: chat.title,
        createdAt: now,
        updatedAt: now,
        pinned: false,
        pinnedAt: null,
      });
    },
    [prependChat],
  );

  const [showSources, setShowSources] = useState(true);

  useEffect(() => {
    if (hasApiToken()) {
      void refresh();
    }
  }, []);

  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      verifyToken(stored).then((res) => {
        if (!res.ok && res.reason === 'unauthorized') {
          setToast({
            message: 'API token is no longer valid — open Settings to update.',
            type: 'warn',
          });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleFirstRunSave = () => {
    setFirstRunOpen(false);
    setShowTokenBanner(false);
    setToast({
      message: "Token saved. You're ready to chat.",
      type: 'success',
    });
    void refresh();
  };

  const handleFirstRunCancel = () => {
    setFirstRunOpen(false);
    setShowTokenBanner(true);
  };

  const handleSuggestion = (text: string) => {
    void send(text);
  };

  const handleSelectChat = (id: number) => {
    void loadChat(id);
  };

  const offline = status === 'offline';

  return (
    <div className="flex h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Sidebar
        models={models}
        model={model}
        onModelChange={(pId, m) => {
          setCurrentId(pId || undefined);
          setSelectedModel(m);
        }}
        providers={providers}
        currentProviderId={providerId}
        onNewChat={clear}
        baseUrl={baseUrl}
        status={status}
        loadingModels={loadingModels}
        onOpenSettings={() => setSettingsOpen(true)}
        onRetry={retry}
        chats={chats}
        activeChatId={chatId}
        onSelectChat={handleSelectChat}
        onRename={rename}
        onPin={pin}
        onDeleteChat={(id) => {
          const wasActive = chatId === id;
          remove(id).then(() => {
            if (wasActive) clear();
          });
        }}
        onExportChat={(id, fmt) => download(id, fmt)}
      />

      <main className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800 sm:px-6 shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-semibold">Beacon Flux Chat</h1>
            {currentProvider ? (
              <ProviderBadge provider={currentProvider} model={model} />
            ) : (
              <span className="hidden truncate rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400 sm:inline">
                {model}
              </span>
            )}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="hidden items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 sm:flex"
              title="Change Ollama endpoint"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${status === 'online'
                    ? 'bg-emerald-500'
                    : status === 'checking'
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
              />
              <span className="max-w-35 truncate font-mono">
                {baseUrl.replace(/^https?:\/\//, '')}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {currentSources.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSources(!showSources)}
                className={`hidden items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors sm:flex ${showSources
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                  }`}
              >
                <Search size={14} />
                Sources
              </button>
            )}
            {loadingModels && (
              <span className="hidden text-xs text-gray-400 sm:inline">
                loading models…
              </span>
            )}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Connection settings"
              title="Connection settings"
              className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 md:hidden"
            >
              <Settings size={18} />
            </button>
            <ThemeToggle theme={theme} onToggle={toggle} />
          </div>
        </header>

        {showTokenBanner && !hasApiToken() && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100 shrink-0">
            <span>
              No API token configured — API calls will return 401. Paste your token in Settings.
            </span>
            <button
              type="button"
              onClick={() => { setSettingsOpen(true); setShowTokenBanner(false); }}
              className="shrink-0 rounded-lg border border-amber-600 px-3 py-1 text-xs font-medium hover:bg-amber-100 dark:border-amber-500 dark:hover:bg-amber-900/40"
            >
              Open Settings
            </button>
          </div>
        )}

        {offline && (
          <div className="m-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 shrink-0">
            {/* ... offline banner ... */}
          </div>
        )}

        {error && (
          <div className="mx-4 mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300 shrink-0">
            {error}
          </div>
        )}
        
        {/* FLEX CONTAINER: Left Column (Chat + Composer) & Right Column (Sources) */}
        <div className="flex flex-1 min-h-0 w-full overflow-hidden relative">
          
          {/* LEFT COLUMN */}
          <div className="flex flex-col flex-1 min-w-0 h-full">
            <ChatWindow
              messages={messages}
              isStreaming={isStreaming}
              progress={progress}
              onPickSuggestion={handleSuggestion}
              sources={currentSources}
            />
            
            {/* COMPOSER (now inside the left column so it aligns perfectly) */}
            <div className="shrink-0 w-full bg-white dark:bg-gray-950 pt-2 pb-4">
              <Composer onSend={send} onStop={stop} isStreaming={isStreaming} />
            </div>
          </div>

          {/* RIGHT COLUMN (SOURCES) */}
          {showSources && currentSources.length > 0 && (
            <SourcesPanel
              sources={currentSources}
              onClose={() => setShowSources(false)}
            />
          )}
        </div>
      </main>

      <SettingsModal
        open={settingsOpen}
        currentUrl={baseUrl}
        status={status}
        onClose={() => setSettingsOpen(false)}
        onSave={(url) => setEndpoint(url)}
        onReset={reset}
      />

      {firstRunOpen && !hasApiToken() && (
        <FirstRunModal
          onSaveSuccess={handleFirstRunSave}
          onCancel={handleFirstRunCancel}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-xl transition-all ${toast.type === 'error' || toast.type === 'warn'
              ? 'border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'
              : 'border border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100'
            }`}
        >
          {toast.type === 'error' || toast.type === 'warn' ? (
            <AlertCircle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <Check size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-xs opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default App;