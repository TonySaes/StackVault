import { assert, describe, it } from 'vitest';

import { FetchLinkChecker } from './fetch-link-checker.js';

describe('FetchLinkChecker', () => {
  it('checks a link with HEAD and manual redirects without reading a response body', async () => {
    const calls: unknown[] = [];
    const checker = new FetchLinkChecker({
      fetcher(sourceUrl, init) {
        calls.push({
          sourceUrl,
          method: init.method,
          redirect: init.redirect,
          hasAbortSignal: init.signal instanceof AbortSignal,
        });

        return Promise.resolve({
          status: 301,
          text() {
            throw new Error('body should not be read');
          },
        });
      },
    });

    const result = await checker.checkLink('https://example.com/redirect');

    assert.deepEqual(result, {
      kind: 'http_response',
      statusCode: 301,
    });
    assert.deepEqual(calls, [
      {
        sourceUrl: 'https://example.com/redirect',
        method: 'HEAD',
        redirect: 'manual',
        hasAbortSignal: true,
      },
    ]);
  });

  it('maps network failures to network_error without exposing the thrown error', async () => {
    const checker = new FetchLinkChecker({
      fetcher() {
        return Promise.reject(new Error('raw network failure'));
      },
    });

    const result = await checker.checkLink('https://example.com/failing');

    assert.deepEqual(result, {
      kind: 'network_error',
    });
  });

  it('aborts slow checks and maps them to timeout', async () => {
    const checker = new FetchLinkChecker({
      timeoutMs: 1,
      fetcher(_sourceUrl, init) {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      },
    });

    const result = await checker.checkLink('https://example.com/slow');

    assert.deepEqual(result, {
      kind: 'timeout',
    });
  });
});
