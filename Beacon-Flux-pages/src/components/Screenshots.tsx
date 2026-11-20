import { Check, Moon, Search, Settings2, Sun } from 'lucide-react';
import { Section } from './ui/Section';

export function Screenshots() {
  return (
    <Section
      eyebrow="In the app"
      title="Looks like a product, not a demo"
      description="Chat history with pin and rename, a first-run token modal, and a tabbed settings panel for connection and providers."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chat window mock */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5">
            <span className="text-xs font-medium text-muted">Chat</span>
            <span className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-border-strong" />
              <span className="h-2 w-2 rounded-full bg-border-strong" />
              <span className="h-2 w-2 rounded-full bg-border-strong" />
            </span>
          </div>
          <div className="space-y-3 p-5">
            <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-sm text-accent-fg">
              How do I rotate the API token?
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2 text-sm text-fg">
              Remove the token volume and recreate the stack:
              <div className="mt-2 rounded-lg bg-bg px-2.5 py-1.5 font-mono text-[11px] text-muted">
                docker volume rm local-ollama-api-token
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-subtle">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              streaming…
            </div>
          </div>
        </div>

        {/* Settings mock */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
            <Settings2 className="h-3.5 w-3.5 text-muted" />
            <span className="text-xs font-medium text-muted">Settings</span>
          </div>
          <div className="p-5">
            {/* Tabs */}
            <div className="mb-4 inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs">
              <span className="rounded-md bg-surface px-3 py-1 font-medium text-fg shadow-sm">
                Connection
              </span>
              <span className="px-3 py-1 text-muted">Providers</span>
            </div>
            {/* Fields */}
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[11px] font-medium text-subtle">
                  Ollama URL
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5 py-1.5 font-mono text-[11px] text-muted">
                  <Search className="h-3 w-3" />
                  http://host.docker.internal:11434
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-subtle">
                  API token
                </p>
                <div className="flex items-center justify-between rounded-lg border border-border bg-bg px-2.5 py-1.5 font-mono text-[11px] text-muted">
                  <span>••••••••••••••••</span>
                  <Check className="h-3 w-3 text-accent" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-bg px-2.5 py-1.5 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Moon className="h-3 w-3" /> Dark theme
                </span>
                <span className="inline-flex items-center gap-1.5 text-subtle">
                  <Sun className="h-3 w-3" /> Light
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}