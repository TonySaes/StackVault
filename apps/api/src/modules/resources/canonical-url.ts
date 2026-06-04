const TRACKING_QUERY_KEYS = new Set(['fbclid', 'gclid']);

function isTrackingQueryKey(queryKey: string) {
  const normalizedQueryKey = queryKey.toLowerCase();

  return (
    normalizedQueryKey.startsWith('utm_') ||
    TRACKING_QUERY_KEYS.has(normalizedQueryKey)
  );
}

// Canonical URL normalization
// Keep the rule local and predictable: strip browser/tracking-only variants
// (hash, utm_*, fbclid, gclid), keep business query params, sort them for
// stable upserts, and fail fast when Node cannot parse the URL.
export function normalizeCanonicalUrl(rawUrl: string): string {
  const url = new URL(rawUrl.trim());

  url.hash = '';

  for (const queryKey of Array.from(url.searchParams.keys())) {
    if (isTrackingQueryKey(queryKey)) {
      url.searchParams.delete(queryKey);
    }
  }

  url.searchParams.sort();

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }

  return url.toString();
}
