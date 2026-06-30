import { assert, describe, it } from 'vitest';

import { classifyLinkCheckResult } from './link-check-result.js';

describe('classifyLinkCheckResult', () => {
  it('classifies successful HTTP responses as active links', () => {
    assert.strictEqual(
      classifyLinkCheckResult({ kind: 'http_response', statusCode: 200 }),
      'active',
    );
    assert.strictEqual(
      classifyLinkCheckResult({ kind: 'http_response', statusCode: 204 }),
      'active',
    );
  });

  it('classifies HTTP redirects as redirected links', () => {
    assert.strictEqual(
      classifyLinkCheckResult({ kind: 'http_response', statusCode: 301 }),
      'redirect',
    );
    assert.strictEqual(
      classifyLinkCheckResult({ kind: 'http_response', statusCode: 308 }),
      'redirect',
    );
  });

  it('classifies HTTP client and server errors as unavailable links', () => {
    assert.strictEqual(
      classifyLinkCheckResult({ kind: 'http_response', statusCode: 404 }),
      'unavailable',
    );
    assert.strictEqual(
      classifyLinkCheckResult({ kind: 'http_response', statusCode: 500 }),
      'unavailable',
    );
  });

  it('classifies network failures and timeouts as unavailable links', () => {
    assert.strictEqual(
      classifyLinkCheckResult({ kind: 'network_error' }),
      'unavailable',
    );
    assert.strictEqual(classifyLinkCheckResult({ kind: 'timeout' }), 'unavailable');
  });

  it('falls back to to_verify for unexpected HTTP status codes', () => {
    assert.strictEqual(
      classifyLinkCheckResult({ kind: 'http_response', statusCode: 0 }),
      'to_verify',
    );
  });
});
