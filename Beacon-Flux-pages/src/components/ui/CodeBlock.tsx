import { CopyButton } from './CopyButton';

interface Props {
  code: string;
  title?: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, title, language = 'bash', className = '' }: Props) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-card ${className}`}
    >
      {(title || language) && (
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
            </span>
            {title && (
              <span className="ml-2 text-xs font-medium text-muted">{title}</span>
            )}
          </div>
          <CopyButton value={code} />
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="font-mono text-fg">{code}</code>
      </pre>
    </div>
  );
}