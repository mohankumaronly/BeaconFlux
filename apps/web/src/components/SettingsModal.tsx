// Single responsibility: Modal dialog shell providing tabbed navigation for application settings.

import { useState } from 'react';
import { X, Server, Cpu } from 'lucide-react';
import { ConnectionTab, type ConnectionTabProps } from './ConnectionTab';
import { ProvidersTab } from './ProvidersTab';

type Tab = 'connection' | 'providers';

export interface SettingsModalProps extends ConnectionTabProps {
  open?: boolean;
  isOpen?: boolean;
}

export function SettingsModal(props: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('connection');
  const isOpen = props.open ?? props.isOpen;
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900">
              {tab === 'connection' ? <Server size={16} /> : <Cpu size={16} />}
            </div>
            <div>
              <h2
                id="settings-title"
                className="text-[15px] font-semibold text-gray-900 dark:text-gray-100"
              >
                Settings
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tab === 'connection'
                  ? 'Configure your Ollama connection and API token'
                  : 'Manage OpenAI-compatible cloud providers and models'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close settings"
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab strip */}
        <div className="flex gap-2 border-b border-gray-200 px-5 pt-2 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setTab('connection')}
            className={`flex items-center gap-1.5 border-b-2 px-3 pb-2 text-xs font-medium transition-colors ${
              tab === 'connection'
                ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Server size={14} />
            Connection
          </button>
          <button
            type="button"
            onClick={() => setTab('providers')}
            className={`flex items-center gap-1.5 border-b-2 px-3 pb-2 text-xs font-medium transition-colors ${
              tab === 'providers'
                ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Cpu size={14} />
            Providers
          </button>
        </div>

        {/* Tab content */}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          {tab === 'connection' ? (
            <ConnectionTab key={props.currentUrl} {...props} />
          ) : (
            <ProvidersTab />
          )}
        </div>
      </div>
    </div>
  );
}
