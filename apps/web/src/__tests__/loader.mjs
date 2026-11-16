export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (result.source) {
    const src = typeof result.source === 'string' ? result.source : new TextDecoder().decode(result.source);
    if (src.includes('import.meta.env')) {
      return {
        ...result,
        source: src.replaceAll('import.meta.env', '(globalThis.__IMPORT_META_ENV__ || {})'),
      };
    }
  }
  return result;
}
