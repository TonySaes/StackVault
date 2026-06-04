import { assert, describe, it } from 'vitest';

import { normalizeCanonicalUrl } from './canonical-url.js';

describe('normalizeCanonicalUrl', () => {
  it('removes tracking variants while preserving meaningful query parameters', () => {
    const canonicalUrl = normalizeCanonicalUrl(
      ' HTTPS://Example.com/releases/?version=2&utm_source=newsletter&fbclid=abc#install ',
    );

    assert.strictEqual(
      canonicalUrl,
      'https://example.com/releases?version=2',
    );
  });
});
