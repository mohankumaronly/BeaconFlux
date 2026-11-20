import { Check } from 'lucide-react';
import { TRUST_ITEMS } from '../lib/constants';

export function TrustStrip() {
  return (
    <div className="border-y border-border bg-surface/60">
      <div className="container-page flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-5">
        {TRUST_ITEMS.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-2 text-xs font-medium text-muted sm:text-sm"
          >
            <Check className="h-4 w-4 text-accent" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}