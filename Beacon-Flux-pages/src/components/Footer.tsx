import { SITE } from '../lib/constants';
import { GithubIcon } from './ui/GithubIcon';

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="container-page flex flex-col items-center justify-between gap-4 py-10 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-fg text-sm">
            🦙
          </span>
          <span className="text-sm font-semibold text-fg">{SITE.name}</span>
          <span className="text-xs text-subtle">v{SITE.version}</span>
        </div>
        <p className="text-xs text-subtle">
          Self-hosted · No telemetry · {SITE.license} License
        </p>
        <a
          href={SITE.github}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
        >
          <GithubIcon className="h-3.5 w-3.5" />
          GitHub
        </a>
      </div>
    </footer>
  );
}