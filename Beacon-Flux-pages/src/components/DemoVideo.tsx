import { Section } from './ui/Section';
import { DEMO } from '../lib/constants';

export function DemoVideo() {
  return (
    <Section
      id="demo"
      eyebrow={DEMO.eyebrow}
      title={DEMO.title}
      description={DEMO.description}
    >
      <div className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
          {/* Browser-style chrome bar */}
          <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
            </div>
            <span className="truncate font-mono text-[11px] text-subtle">
              localhost:8080
            </span>
            <span className="w-[38px]" aria-hidden />
          </div>

          {/* Auto-playing video */}
          <div className="relative aspect-video w-full bg-black">
            <video
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            >
              {DEMO.srcWebm && (
                <source src={DEMO.srcWebm} type="video/webm" />
              )}
              <source src={DEMO.src} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-subtle">
          Silent looping demo · rendered on a single machine with a local model
        </p>
      </div>
    </Section>
  );
}