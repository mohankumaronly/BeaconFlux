import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NAV_LINKS, SITE } from '../lib/constants';
import { ThemeToggle } from './ui/ThemeToggle';
import { GithubIcon } from './ui/GithubIcon';

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'border-b border-border bg-bg/80 backdrop-blur-lg'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="container-page flex h-16 items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg text-lg">
            🦙
          </span>
          <span className="text-base font-bold tracking-tight text-fg">
            {SITE.name}
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href={SITE.github}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:border-border-strong hover:text-fg sm:inline-flex"
          >
            <GithubIcon className="h-4 w-4" />
          </a>
          <a href="#quick-start" className="btn-primary hidden sm:inline-flex">
            Get Started
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border bg-surface md:hidden">
          <nav className="container-page flex flex-col gap-1 py-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#quick-start"
              onClick={() => setOpen(false)}
              className="btn-primary mt-2"
            >
              Get Started
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}