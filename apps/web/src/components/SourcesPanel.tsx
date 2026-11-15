import { X, MoreVertical } from 'lucide-react';
import type { WebSource } from '@local-ollama/shared';

export function SourcesPanel({
  sources,
  onClose,
}: {
  sources: WebSource[];
  onClose: () => void;
}) {
  if (sources.length === 0) return null;

  return (
    <div className="w-[380px] border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 flex flex-col shrink-0 transition-all duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800/50">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Sources</h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {sources.map((source, i) => {
          let domain = '';
          try {
            domain = new URL(source.url).hostname.replace(/^www\./, '');
          } catch (e) {
            domain = source.url;
          }

          const dateStr = source.publishedDate 
            ? new Date(source.publishedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : null;

          return (
            <a
              key={i}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-3 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/80 transition-all duration-200"
            >
              {/* Top Row: Favicon, Domain */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <img 
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
                    alt={domain}
                    className="h-4 w-4 rounded-full bg-white object-contain p-0.5"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                    {domain}
                  </span>
                </div>
                <MoreVertical size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Main Content Row: Text on left, Thumbnail on right */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {source.title}
                  </h4>
                  
                  {source.snippet && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed mb-2">
                      {source.snippet}
                    </p>
                  )}

                  {dateStr && (
                    <div className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                      {dateStr}
                    </div>
                  )}
                </div>

                {/* Thumbnail Image */}
                {source.thumbnail && (
                  <div className="shrink-0">
                    <img 
                      src={source.thumbnail} 
                      alt={source.title} 
                      className="h-[60px] w-[80px] rounded-lg object-cover border border-gray-100 dark:border-gray-800 bg-gray-100 dark:bg-gray-800"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            </a>
          );
        })}

        {/* Show All Button */}
        <button className="w-full rounded-2xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors mt-2">
          Show all
        </button>
      </div>
    </div>
  );
}
