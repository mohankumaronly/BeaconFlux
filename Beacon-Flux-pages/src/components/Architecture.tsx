import { ArrowDown, ArrowRight } from 'lucide-react';
import { Section } from './ui/Section';
import { ARCH_FLOW } from '../lib/constants';

export function Architecture() {
  return (
    <Section
      eyebrow="Architecture"
      title="Four moving parts. One command."
      description="Every request goes through a single authenticated path. Only nginx is exposed externally."
    >
      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
        {ARCH_FLOW.map((node, i) => (
          <div key={node.title} className="contents">
            <div className="card flex-1 p-5">
              <p className="text-sm font-semibold text-fg">{node.title}</p>
              <p className="mt-0.5 font-mono text-xs text-accent">{node.sub}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {node.detail}
              </p>
            </div>
            {i < ARCH_FLOW.length - 1 && (
              <>
                <ArrowDown className="mx-auto h-5 w-5 shrink-0 text-subtle lg:hidden" />
                <ArrowRight className="hidden h-5 w-5 shrink-0 text-subtle lg:block" />
              </>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}