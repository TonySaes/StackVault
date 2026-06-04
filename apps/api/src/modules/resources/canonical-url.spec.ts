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

  it('sorts meaningful query parameters deterministically', () => {
    const canonicalUrl = normalizeCanonicalUrl(
      'https://example.com/releases?version=2&channel=stable',
    );

    assert.strictEqual(
      canonicalUrl,
      'https://example.com/releases?channel=stable&version=2',
    );
  });

  it('throws when the raw URL is invalid', () => {
    assert.throws(() => normalizeCanonicalUrl('not a valid url'), TypeError);
  });
});
