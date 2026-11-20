import { Cpu, Plug } from 'lucide-react';
import { Section } from './ui/Section';
import { PROVIDERS } from '../lib/constants';

export function Providers() {
  return (
    <Section
      id="providers"
      eyebrow="Providers"
      title="Ollama first. Bring your own cloud."
      description="Native local Ollama out of the box, plus any OpenAI-compatible endpoint. Keys are encrypted at rest with AES-256-GCM and never exposed in the DOM."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PROVIDERS.map((p) => {
          const isNative = p.name === 'Ollama';
          const Icon = isNative ? Cpu : Plug;
          return (
            <div
              key={p.name}
              className="card card-hover flex items-center gap-3 p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">
                  {p.name}
                </p>
                <p className="truncate text-xs text-subtle">{p.note}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mx-auto mt-8 max-w-xl text-center text-sm text-muted">
        Switching providers is a two-click flow in Settings. The sidebar model
        picker becomes a two-level{' '}
        <span className="font-medium text-fg">Provider ▸ Model</span> selector
        once cloud providers are configured.
      </p>
    </Section>
  );
}