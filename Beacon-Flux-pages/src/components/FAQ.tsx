import { ChevronDown } from 'lucide-react';
import { Section } from './ui/Section';
import { FAQ_ITEMS } from '../lib/constants';

export function FAQ() {
  return (
    <Section
      id="faq"
      eyebrow="FAQ"
      title="Honest answers"
      description="What it does, what it doesn't, and how to get unstuck."
    >
      <div className="mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border bg-surface">
        {FAQ_ITEMS.map((item) => (
          <details key={item.q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-fg">
              {item.q}
              <ChevronDown className="h-4 w-4 shrink-0 text-subtle transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}