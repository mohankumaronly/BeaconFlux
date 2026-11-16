// Single responsibility: Connection settings tab for Ollama endpoint configuration and API token.

import { useEffect, useState } from 'react';
import {
  Check,
  Loader2,
  AlertCircle,
  RotateCcw,
  KeyRound,
  Link2,
  Zap,
} from 'lucide-react';
import { isValidUrl, normalizeUrl } from '../lib/ollama';
import { testOllama, setApiToken, hasApiToken } from '../lib/api';
import type { ConnectionStatus } from '../hooks/useConnection';

export interface ConnectionTabProps {
  currentUrl: string;
  status: ConnectionStatus;
  onClose: () => void;
  onSave: (url: string) => boolean;
  onReset: () => void;
}

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; models: string[] }
  | { kind: 'fail'; message: string };

const PRESETS: Array<{ label: string; url: string; hint: string }> = [
  {
    label: 'Local machine',
    url: 'http://localhost:11434',
    hint: 'Ollama running on this computer',
  },
  {
    label: 'Local (127.0.0.1)',
    url: 'http://127.0.0.1:11434',
    hint: 'Alternative local address',
  },
  {
    label: 'Cloudflare Tunnel',
    url: 'https://your-tunnel.trycloudflare.com',
    hint: 'Expose a cloud/remote Ollama over HTTPS',
  },
];

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-gray-700 dark:text-gray-300">
      <Icon size={14} className="text-gray-400 dark:text-gray-500" />
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: ConnectionStatus }) {
  const styles = {
    online: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    checking: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    offline: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  }[status];
  const dot = {
    online: 'bg-emerald-500',
    checking: 'bg-amber-500 animate-pulse',
    offline: 'bg-red-500',
  }[status];
  const label = {
    online: 'Online',
    checking: 'Checking…',
    offline: 'Offline',
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${styles}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function TestResult({ test }: { test: TestState }) {
  if (test.kind === 'idle') return null;

  const base =
    'mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed';
  const styles =
    test.kind === 'ok'
      ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
      : test.kind === 'fail'
        ? 'border border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200'
        : 'border border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300';

  return (
    <div className={`${base} ${styles}`}>
      {test.kind === 'testing' && (
        <>
          <Loader2 size={14} className="mt-0.5 animate-spin shrink-0" />
          <span>Contacting Ollama…</span>
        </>
      )}
      {test.kind === 'ok' && (
        <>
          <Check size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-medium">Connected successfully</p>
            <p className="mt-0.5 text-[11px] opacity-80">
              {test.models.length === 0
                ? 'No models installed yet. Run "ollama pull <model>" in your terminal.'
                : `Available: ${test.models.slice(0, 4).join(', ')}${
                    test.models.length > 4 ? ` +${test.models.length - 4} more` : ''
                  }`}
            </p>
          </div>
        </>
      )}
      {test.kind === 'fail' && (
        <>
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-medium">Connection failed</p>
            <p className="mt-0.5 text-[11px] opacity-80">{test.message}</p>
          </div>
        </>
      )}
    </div>
  );
}

export function ConnectionTab({
  currentUrl,
  status,
  onClose,
  onSave,
  onReset,
}: ConnectionTabProps) {
  const [value, setValue] = useState(currentUrl);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSaved, setTokenSaved] = useState(false);

  useEffect(() => {
    setValue(currentUrl);
    setTest({ kind: 'idle' });
  }, [currentUrl]);

  useEffect(() => {
    setTokenSaved(hasApiToken());
  }, []);

  const trimmed = normalizeUrl(value);
  const formatOk = isValidUrl(trimmed);
  const showFormatError = !formatOk && value.trim() !== '';

  const runTest = async () => {
    if (!formatOk) {
      setTest({ kind: 'fail', message: 'Enter a valid http(s) URL first.' });
      return;
    }
    setTest({ kind: 'testing' });
    const result = await testOllama(trimmed);
    if (result.ok) setTest({ kind: 'ok', models: result.models });
    else setTest({ kind: 'fail', message: result.error });
  };

  const saveToken = () => {
    const t = tokenInput.trim();
    if (!t) return;
    setApiToken(t);
    setTokenSaved(true);
    setTokenInput('');
  };

  const clearToken = () => {
    setApiToken(null);
    setTokenSaved(false);
    setTokenInput('');
  };

  const save = () => {
    if (!formatOk) return;
    const ok = onSave(trimmed);
    if (ok) onClose();
  };

  return (
    <div className="space-y-6">
      {/* Current status strip */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 dark:border-gray-800 dark:bg-gray-800/50">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Current endpoint
          </p>
          <p className="truncate font-mono text-xs text-gray-700 dark:text-gray-300">
            {currentUrl}
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      {/* Endpoint URL */}
      <section>
        <SectionLabel icon={Link2}>Endpoint URL</SectionLabel>
        <input
          id="endpoint"
          type="url"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setTest({ kind: 'idle' });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
          placeholder="http://localhost:11434"
          spellCheck={false}
          className={[
            'w-full rounded-lg border bg-white px-3 py-2.5 font-mono text-sm outline-none transition-colors',
            'dark:bg-gray-800 dark:text-gray-100',
            showFormatError
              ? 'border-red-400 focus:border-red-500'
              : 'border-gray-300 focus:border-gray-900 dark:border-gray-700 dark:focus:border-gray-400',
          ].join(' ')}
        />
        {showFormatError && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <AlertCircle size={12} /> Must start with http:// or https://
          </p>
        )}

        {/* Presets */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PRESETS.map((p) => {
            const selected = value === p.url;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setValue(p.url);
                  setTest({ kind: 'idle' });
                }}
                title={p.hint}
                className={[
                  'rounded-lg border px-2.5 py-2 text-left text-xs transition-colors',
                  selected
                    ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-300 dark:bg-white dark:text-gray-900'
                    : 'border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-800',
                ].join(' ')}
              >
                <span className="block font-medium">{p.label}</span>
                <span
                  className={[
                    'block truncate font-mono text-[10px]',
                    selected ? 'opacity-70' : 'text-gray-400 dark:text-gray-500',
                  ].join(' ')}
                >
                  {p.url}
                </span>
              </button>
            );
          })}
        </div>

        <TestResult test={test} />
      </section>

      {/* API Token */}
      <section>
        <SectionLabel icon={KeyRound}>API Token</SectionLabel>
        {tokenSaved ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/50">
            <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Token saved securely on this device
            </span>
            <button
              type="button"
              onClick={clearToken}
              className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              id="api-token"
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveToken();
              }}
              placeholder="Paste your API token…"
              spellCheck={false}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-mono text-sm outline-none transition-colors focus:border-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-400"
            />
            <button
              type="button"
              onClick={saveToken}
              disabled={!tokenInput.trim()}
              className="rounded-lg bg-gray-900 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            >
              Save
            </button>
          </div>
        )}
        <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          Required for all API calls. Find your token in the terminal banner by running{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] dark:bg-gray-800">
            docker compose logs server
          </code>
          .
        </p>
      </section>

      {/* Cloudflare hint */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-3 dark:border-blue-900 dark:bg-blue-950/40">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-blue-900 dark:text-blue-200">
          <Zap size={13} /> Cloudflare Tunnel
        </div>
        <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-200/90">
          Run{' '}
          <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-[11px] dark:bg-blue-900/60">
            cloudflared tunnel --url http://localhost:11434
          </code>{' '}
          and paste the resulting{' '}
          <code className="font-mono text-[11px]">https://….trycloudflare.com</code> URL above. Ensure
          the remote Ollama allows your origin via{' '}
          <code className="font-mono text-[11px]">OLLAMA_ORIGINS</code>.
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={runTest}
            disabled={test.kind === 'testing' || !formatOk}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {test.kind === 'testing' ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Testing…
              </span>
            ) : (
              'Test connection'
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              onReset();
              onClose();
            }}
            title="Reset to the default local endpoint"
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-white dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!formatOk}
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Save & connect
          </button>
        </div>
      </div>
    </div>
  );
}
