import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string | null;
  thumbnail?: string;
};

export async function webSearch(
  query: string,
  limit = 5,
  signal?: AbortSignal,
): Promise<WebSearchResult[]> {
  const timeoutSignal = AbortSignal.timeout(5000);
  const effectiveSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  const url = new URL('/search', env.SEARXNG_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');

  try {
    const res = await fetch(url, { signal: effectiveSignal });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'searxng returned non-ok status');
      return [];
    }
    const data = (await res.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        publishedDate?: string | null;
        thumbnail?: string;
        img_src?: string;
      }>;
    };
    logger.debug(
      { query, count: data.results?.length ?? 0 },
      'web search completed',
    );
    return (data.results ?? [])
      .filter((r) => r.url && (r.content || r.title))
      .slice(0, limit)
      .map((r) => ({
        title: r.title ?? r.url!,
        url: r.url!,
        snippet: (r.content ?? '').trim(),
        publishedDate: r.publishedDate ?? null,
        // Map SearXNG's img_src to our thumbnail field
        thumbnail: r.thumbnail || r.img_src || undefined,
      }));
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      'web search failed, continuing without context',
    );
    return [];
  }
}

export function formatSearchContext(results: WebSearchResult[]): string {
  if (results.length === 0) return '';

  const lines = results.map((r, i) => {
    const date = r.publishedDate ? ` (${r.publishedDate})` : '';
    
    // 👇 FIX: Only use r.thumbnail, which is already defined in the type
    const imageStr = r.thumbnail ? `\nImage URL: ${r.thumbnail}` : '';

    return `[${i + 1}] ${r.title}${date}\n${r.snippet}${imageStr}\nSource: ${r.url}`;
  });

  return [
    'The following web search results may help answer the user.',
    'IMPORTANT: If the user asks for images, or if an Image URL is provided, you MUST display the image directly in your response using this exact syntax:',
    '![Image Description](The_Exact_Image_URL_Here)',
    'Do NOT provide bare links and do NOT tell the user to visit a website. Embed the image using the Markdown syntax above. If no Image URL is provided, do not attempt to create one.',
    ...lines,
  ].join('\n\n');
}