import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Section } from './ui/Section';
import { CodeBlock } from './ui/CodeBlock';
import { QUICKSTART_TABS } from '../lib/constants';

type QuickStartTabId = (typeof QUICKSTART_TABS)[number]['id'];

export function QuickStart() {
  const [active, setActive] = useState<QuickStartTabId>(QUICKSTART_TABS[0].id);
  const tab = QUICKSTART_TABS.find((t) => t.id === active) ?? QUICKSTART_TABS[0];

  return (
    <Section
      id="quick-start"
      eyebrow="Quick Start"
      title="Running in under a minute"
      description="Three commands, no .env files, no manual migrations. The container handles the rest."
    >
      {/* Tabs */}
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {QUICKSTART_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
              active === t.id
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-border bg-surface text-muted hover:border-border-strong hover:text-fg'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-3xl">
        <p className="mb-4 text-center text-sm text-muted">{tab.description}</p>
        <CodeBlock code={tab.code} title={tab.label} />

        <ul className="mt-6 space-y-2">
          {tab.next.map((step) => (
            <li
              key={step}
              className="flex items-start gap-2.5 text-sm text-muted"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>{step}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 text-center">
          <a
            href="#features"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
          >
            See what's inside
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </Section>
  );
}