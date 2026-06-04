const TRACKING_QUERY_KEYS = new Set(['fbclid', 'gclid']);

function isTrackingQueryKey(queryKey: string) {
  const normalizedQueryKey = queryKey.toLowerCase();

  return (
    normalizedQueryKey.startsWith('utm_') ||
    TRACKING_QUERY_KEYS.has(normalizedQueryKey)
  );
}

// Canonical URL normalization
// We only remove variants that usually come from tracking. Business query
// parameters stay in place because some sources use them to identify content.
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
