import { assert, describe, it } from 'vitest';

import {
  buildIngestionErrorLogEntry,
  MAX_INGESTION_ERROR_MESSAGE_LENGTH,
  sanitizeIngestionErrorMessage,
  sanitizeIngestionErrorType,
} from './ingestion-error-log.js';

const nonSensitiveFallbackMessage =
  'Ingestion failed with a non-sensitive internal error code.';

describe('buildIngestionErrorLogEntry', () => {
  it('maps a source error into the internal persistence shape', () => {
    const occurredAt = new Date('2026-06-11T10:15:00.000Z');
    const entry = buildIngestionErrorLogEntry({
      source: {
        id: 'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
        status: 'active',
      },
      errorType: 'page.fetchFailed',
      message: 'Source returned a fetch error.',
      occurredAt,
    });

    assert.deepEqual(entry, {
      sourceId: 'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
      occurredAt,
      errorType: 'page.fetchFailed',
      message: 'Source returned a fetch error.',
      sourceStatus: 'active',
    });
  });

  it('uses the current date when no occurrence date is provided', () => {
    const before = Date.now();
    const entry = buildIngestionErrorLogEntry({
      source: {
        id: 'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
        status: 'inactive',
      },
      errorType: 'entry.titleMissing',
      message: 'Title metadata is missing.',
    });
    const after = Date.now();

    assert.strictEqual(entry.sourceStatus, 'inactive');
    assert.ok(entry.occurredAt.getTime() >= before);
    assert.ok(entry.occurredAt.getTime() <= after);
  });
});

describe('sanitizeIngestionErrorType', () => {
  it('keeps stable technical error identifiers', () => {
    assert.strictEqual(
      sanitizeIngestionErrorType('adapter:public_metadata.page-fetch_failed'),
      'adapter:public_metadata.page-fetch_failed',
    );
  });

  it('replaces invalid or payload-like error types with a fallback code', () => {
    assert.strictEqual(sanitizeIngestionErrorType(''), 'ingestion.unknown');
    assert.strictEqual(
      sanitizeIngestionErrorType('<html>provider body</html>'),
      'ingestion.unknown',
    );
  });
});

describe('sanitizeIngestionErrorMessage', () => {
  it('normalizes harmless whitespace and control characters', () => {
    assert.strictEqual(
      sanitizeIngestionErrorMessage('  Fetch\nfailed\u0007 for source.  '),
      'Fetch failed for source.',
    );
  });

  it('replaces empty messages with a non-sensitive fallback', () => {
    assert.strictEqual(
      sanitizeIngestionErrorMessage(null),
      nonSensitiveFallbackMessage,
    );
    assert.strictEqual(
      sanitizeIngestionErrorMessage('   '),
      nonSensitiveFallbackMessage,
    );
  });

  it('replaces raw HTML or XML-looking provider payloads', () => {
    assert.strictEqual(
      sanitizeIngestionErrorMessage('<html><body>Full provider page</body></html>'),
      nonSensitiveFallbackMessage,
    );
    assert.strictEqual(
      sanitizeIngestionErrorMessage('<rss><channel>Full feed</channel></rss>'),
      nonSensitiveFallbackMessage,
    );
  });

  it('replaces secret-bearing messages and stack traces', () => {
    assert.strictEqual(
      sanitizeIngestionErrorMessage('Authorization: Bearer provider-token'),
      nonSensitiveFallbackMessage,
    );
    assert.strictEqual(
      sanitizeIngestionErrorMessage(
        'Error: failed\n at main (file:///app/src/run.ts:12:3)',
      ),
      nonSensitiveFallbackMessage,
    );
  });

  it('truncates long messages to the persistence limit', () => {
    const message = sanitizeIngestionErrorMessage('a'.repeat(600));

    assert.strictEqual(message.length, MAX_INGESTION_ERROR_MESSAGE_LENGTH);
    assert.strictEqual(message.endsWith('...'), true);
  });
});
