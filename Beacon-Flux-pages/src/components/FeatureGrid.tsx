import {
  Cpu,
  Database,
  Zap,
  Shield,
  Layers,
  Plug,
  Search,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import { Section } from './ui/Section';
import { FEATURES } from '../lib/constants';

const ICONS: Record<string, LucideIcon> = {
  cpu: Cpu,
  database: Database,
  zap: Zap,
  shield: Shield,
  layers: Layers,
  plug: Plug,
  search: Search,
  lock: Lock,
};

export function FeatureGrid() {
  return (
    <Section
      id="features"
      eyebrow="Features"
      title="Everything a serious local chat needs"
      description="Built for people who already run Ollama and want a UI that behaves like a product, not a demo."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => {
          const Icon = ICONS[f.icon] ?? Cpu;
          return (
            <div
              key={f.title}
              className="card card-hover p-5 text-left"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-fg">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {f.body}
              </p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}