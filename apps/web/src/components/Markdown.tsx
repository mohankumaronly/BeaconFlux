import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';
import type { WebSource } from '@local-ollama/shared';
import { ImageOff } from 'lucide-react';
import { useState, useEffect } from 'react';

function SafeImage({ src, alt, sources }: { src?: string; alt?: string; sources: WebSource[] }) {
  const [error, setError] = useState(false);
  const [finalSrc, setFinalSrc] = useState(src);

  // If the URL changes (streaming updates), reset the error state
  useEffect(() => {
    setFinalSrc(src);
    setError(false);
  }, [src]);

  const handleError = () => {
    // If it fails, find a fallback thumbnail from the sources
    const fallback = sources.find(s => s.thumbnail)?.thumbnail;
    if (fallback && fallback !== finalSrc) {
      // Try the fallback URL instead
      setFinalSrc(fallback);
    } else {
      // If no fallback exists, show the error UI
      setError(true);
    }
  };

  if (!finalSrc || error) {
    return (
      <span className="flex items-center justify-center p-4 my-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 text-sm">
        <ImageOff className="mr-2" size={18} />
        Image unavailable ({alt || 'No description'})
      </span>
    );
  }

  return (
    <span className="flex flex-col items-center my-4 w-full">
      <img 
        src={finalSrc} 
        alt={alt || "Rendered image"}
        onError={handleError}
        className="max-w-full max-h-[400px] h-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-md object-contain bg-gray-50 dark:bg-gray-900" 
        loading="lazy"
      />
      {alt && alt !== "Rendered image" && (
        <span className="text-xs text-gray-500 mt-2 italic">{alt}</span>
      )}
    </span>
  );
}

export function Markdown({ content, sources = [] }: { content: string; sources?: WebSource[] }) {
  // Intercept empty `![alt]()` tags before ReactMarkdown processes them
  const fixEmptyImages = (text: string) => {
    return text.replace(/!\[([^\]]*)\]\(\s*\)/g, (match, altText) => {
      // Find matching source by title
      const source = sources.find(s => 
        s.title.toLowerCase().includes(altText.toLowerCase().trim()) || 
        altText.toLowerCase().trim().includes(s.title.toLowerCase())
      );
      if (source && source.thumbnail) {
        return `![${altText}](${source.thumbnail})`;
      }
      // If no direct match, just inject the first available thumbnail
      const fallbackSource = sources.find(s => s.thumbnail);
      if (fallbackSource) {
        return `![${altText}](${fallbackSource.thumbnail})`;
      }
      return match;
    });
  };

  const processedContent = fixEmptyImages(content);

  return (
    <div className="
      prose prose-base max-w-none wrap-break-word dark:prose-invert
      prose-headings:scroll-mt-24
      prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg
      prose-p:leading-7
      prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0
      prose-table:my-4 prose-table:text-sm
      prose-th:border prose-th:border-gray-300 prose-th:bg-gray-100 prose-th:px-3 prose-th:py-1.5 prose-th:text-left dark:prose-th:border-gray-700 dark:prose-th:bg-gray-800
      prose-td:border prose-td:border-gray-300 prose-td:px-3 prose-td:py-1.5 dark:prose-td:border-gray-700
      prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic dark:prose-blockquote:border-gray-600
      prose-hr:my-6
      prose-ul:my-3 prose-ol:my-3 prose-li:my-0.5
      prose-a:no-underline hover:prose-a:underline
    ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          img: ({ node, ...props }) => (
            // Use the SafeImage component here
            <SafeImage src={props.src} alt={props.alt} sources={sources} />
          ),
          code({ className, children, ...props }) {
            const isBlock = /language-/.test(className ?? '');
            if (!isBlock) {
              return (
                <code className="rounded bg-gray-200 px-1.5 py-0.5 text-[0.85em] font-mono dark:bg-gray-700" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noreferrer noopener" className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                {children}
              </a>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}