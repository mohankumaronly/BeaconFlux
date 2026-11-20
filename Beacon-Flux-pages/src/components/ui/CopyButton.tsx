import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  className?: string;
  label?: string;
}

export function CopyButton({ value, className = '', label }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  }, [value]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border
                  bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-muted
                  transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-2
                  focus-visible:outline-offset-2 focus-visible:outline-accent
                  ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-accent" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>{label ?? 'Copy'}</span>
        </>
      )}
    </button>
  );
}