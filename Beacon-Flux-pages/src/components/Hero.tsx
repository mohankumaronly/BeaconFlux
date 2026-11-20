import { ArrowRight, Terminal } from 'lucide-react';
import { GithubIcon } from './ui/GithubIcon';
import { CopyButton } from './ui/CopyButton';
import { HERO, SITE, DOCKER_RUN_CMD } from '../lib/constants';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(600px circle at 20% 0%, var(--accent-soft), transparent 60%)',
        }}
      />

      <div className="container-page grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-2 lg:gap-16">
        {/* Left — copy */}
        {/* ADDED: min-w-0 to prevent squishing */}
        <div className="animate-fade-up min-w-0">
          <p className="eyebrow mb-4">{HERO.eyebrow}</p>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-fg sm:text-5xl lg:text-[3.4rem]">
            {HERO.headline}{' '}
            <span className="text-accent">{HERO.headlineAccent}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {HERO.subhead}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="#quick-start" className="btn-primary">
              <Terminal className="h-4 w-4" />
              Get Started
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={SITE.github}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              <GithubIcon className="h-4 w-4" />
              {HERO.secondaryCta}
            </a>
          </div>

          {/* Copy command strip */}
          <div className="mt-6 flex max-w-xl items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-sm">
            <code className="flex-1 truncate font-mono text-[13px] text-muted">
              docker run -d -p 8080:8080 {SITE.image}
            </code>
            <CopyButton value={DOCKER_RUN_CMD} />
          </div>

          <p className="mt-4 text-xs text-subtle">
            Open source · MIT · No telemetry · Docker Hub image available
          </p>
        </div>

        {/* Right — terminal banner mock */}
        {/* ADDED: w-full to ensure it fills the grid cell properly */}
        <div className="animate-fade-up w-full min-w-0 lg:pl-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
              </div>
              <span className="truncate text-xs font-medium text-subtle">
                docker compose logs -f server
              </span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-relaxed text-muted">
{`🦙  L O C A L   O L L A M A
    chat interface · self-hosted · private
                  ✅  READY

╭──────────────────────────────────────────╮
│  🌐  ACCESS                               │
│     http://localhost:8080                 │
│     http://host.docker.internal:11434     │
├──────────────────────────────────────────┤
│  🔑  API TOKEN                            │
│     <YOUR_API_TOKEN>                      │
│     👉 paste into Settings on first load  │
╰──────────────────────────────────────────╯

💾 token persisted at /app/data/api-token`}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}