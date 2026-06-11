import { assert, describe, it, vi } from 'vitest';

import {
  buildIngestionErrorLogEntry,
  createIngestionErrorLogPersistence,
  DEFAULT_INGESTION_ERROR_HISTORY_LIMIT,
  type IngestionErrorLogPersistencePort,
  type IngestionErrorLogWriter,
  MAX_INGESTION_ERROR_MESSAGE_LENGTH,
  recordIngestionError,
  recordIngestionReportErrors,
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

describe('recordIngestionError', () => {
  it('writes the sanitized error then prunes the source history', async () => {
    const persistence: IngestionErrorLogPersistencePort = {
      createIngestionError: vi.fn().mockResolvedValue({
        ingestionErrorId: '7eb45381-6b55-4692-8d54-f5893d71441d',
      }),
      pruneIngestionErrorsForSource: vi.fn().mockResolvedValue(undefined),
    };
    const result = await recordIngestionError(
      {
        source: {
          id: 'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
          status: 'active',
        },
        errorType: 'page.fetchFailed',
        message: '<html>Full provider body</html>',
        occurredAt: new Date('2026-06-11T10:15:00.000Z'),
      },
      {
        persistence,
      },
    );

    assert.deepEqual(result, {
      ingestionErrorId: '7eb45381-6b55-4692-8d54-f5893d71441d',
    });
    assert.deepEqual(vi.mocked(persistence.createIngestionError).mock.calls[0]?.[0], {
      sourceId: 'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
      occurredAt: new Date('2026-06-11T10:15:00.000Z'),
      errorType: 'page.fetchFailed',
      message: nonSensitiveFallbackMessage,
      sourceStatus: 'active',
    });
    assert.deepEqual(vi.mocked(persistence.pruneIngestionErrorsForSource).mock.calls, [
      [
        'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
        DEFAULT_INGESTION_ERROR_HISTORY_LIMIT,
      ],
    ]);
  });

  it('uses a custom positive history limit when provided', async () => {
    const persistence: IngestionErrorLogPersistencePort = {
      createIngestionError: vi.fn().mockResolvedValue({
        ingestionErrorId: '7eb45381-6b55-4692-8d54-f5893d71441d',
      }),
      pruneIngestionErrorsForSource: vi.fn().mockResolvedValue(undefined),
    };

    await recordIngestionError(
      {
        source: {
          id: 'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
          status: 'active',
        },
        errorType: 'entry.titleMissing',
        message: 'Title is missing.',
      },
      {
        persistence,
        historyLimit: 5,
      },
    );

    assert.deepEqual(vi.mocked(persistence.pruneIngestionErrorsForSource).mock.calls, [
      ['dc0db0b4-5670-4285-8f4d-7ef4cf68af89', 5],
    ]);
  });
});

describe('recordIngestionReportErrors', () => {
  it('records adapter and ingestion errors from a run report', async () => {
    const persistence: IngestionErrorLogPersistencePort = {
      createIngestionError: vi
        .fn()
        .mockResolvedValue({ ingestionErrorId: 'created-error' }),
      pruneIngestionErrorsForSource: vi.fn().mockResolvedValue(undefined),
    };
    const recordedCount = await recordIngestionReportErrors(
      {
        source: {
          id: 'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
          status: 'active',
        },
        report: {
          adapter: {
            entries: [
              {
                errors: [{ code: 'page.fetchFailed', field: 'url' }],
              },
            ],
          },
          ingestion: {
            items: [
              {
                errors: [{ code: 'persistence.failed', field: 'persistence' }],
              },
            ],
          },
        },
        adapterLabel: 'Public metadata adapter',
        ingestionLabel: 'Public metadata ingestion',
      },
      {
        persistence,
      },
    );

    assert.strictEqual(recordedCount, 2);
    assert.deepEqual(
      vi.mocked(persistence.createIngestionError).mock.calls.map(
        ([entry]) => ({
          errorType: entry.errorType,
          message: entry.message,
        }),
      ),
      [
        {
          errorType: 'page.fetchFailed',
          message: 'Public metadata adapter error page.fetchFailed on url.',
        },
        {
          errorType: 'persistence.failed',
          message:
            'Public metadata ingestion error persistence.failed on persistence.',
        },
      ],
    );
  });

  it('does not record warnings-only reports', async () => {
    const persistence: IngestionErrorLogPersistencePort = {
      createIngestionError: vi
        .fn()
        .mockResolvedValue({ ingestionErrorId: 'created-error' }),
      pruneIngestionErrorsForSource: vi.fn().mockResolvedValue(undefined),
    };
    const warningsOnlyReport = {
      adapter: {
        entries: [
          {
            warnings: [{ code: 'metadata.summaryMissing', field: 'summary' }],
            errors: [],
          },
        ],
      },
      ingestion: {
        items: [
          {
            warnings: [{ code: 'entry.technologyMissing', field: 'technology' }],
            errors: [],
          },
        ],
      },
    };
    const recordedCount = await recordIngestionReportErrors(
      {
        source: {
          id: 'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
          status: 'active',
        },
        report: warningsOnlyReport,
        adapterLabel: 'Public metadata adapter',
        ingestionLabel: 'Public metadata ingestion',
      },
      {
        persistence,
      },
    );

    assert.strictEqual(recordedCount, 0);
    assert.strictEqual(
      vi.mocked(persistence.createIngestionError).mock.calls.length,
      0,
    );
    assert.strictEqual(
      vi.mocked(persistence.pruneIngestionErrorsForSource).mock.calls.length,
      0,
    );
  });
});

describe('createIngestionErrorLogPersistence', () => {
  it('creates an ingestion error through a Prisma-compatible writer', async () => {
    const writer: IngestionErrorLogWriter = {
      ingestionError: {
        create: vi.fn().mockResolvedValue({
          id: '7eb45381-6b55-4692-8d54-f5893d71441d',
        }),
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const persistence = createIngestionErrorLogPersistence(writer);
    const result = await persistence.createIngestionError({
      sourceId: 'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
      occurredAt: new Date('2026-06-11T10:15:00.000Z'),
      errorType: 'page.fetchFailed',
      message: 'Source returned a fetch error.',
      sourceStatus: 'active',
    });

    assert.deepEqual(result, {
      ingestionErrorId: '7eb45381-6b55-4692-8d54-f5893d71441d',
    });
    assert.deepEqual(vi.mocked(writer.ingestionError.create).mock.calls, [
      [
        {
          data: {
            sourceId: 'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
            occurredAt: new Date('2026-06-11T10:15:00.000Z'),
            errorType: 'page.fetchFailed',
            message: 'Source returned a fetch error.',
            sourceStatus: 'active',
          },
          select: {
            id: true,
          },
        },
      ],
    ]);
  });

  it('prunes errors after the kept source history window', async () => {
    const writer: IngestionErrorLogWriter = {
      ingestionError: {
        create: vi.fn().mockResolvedValue({
          id: '7eb45381-6b55-4692-8d54-f5893d71441d',
        }),
        findMany: vi.fn().mockResolvedValue([
          { id: 'stale-error-1' },
          { id: 'stale-error-2' },
        ]),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const persistence = createIngestionErrorLogPersistence(writer);

    await persistence.pruneIngestionErrorsForSource(
      'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
      20,
    );

    assert.deepEqual(vi.mocked(writer.ingestionError.findMany).mock.calls, [
      [
        {
          where: {
            sourceId: 'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
          },
          orderBy: [
            { occurredAt: 'desc' },
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          skip: 20,
          select: {
            id: true,
          },
        },
      ],
    ]);
    assert.deepEqual(vi.mocked(writer.ingestionError.deleteMany).mock.calls, [
      [
        {
          where: {
            sourceId: 'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
            id: {
              in: ['stale-error-1', 'stale-error-2'],
            },
          },
        },
      ],
    ]);
  });

  it('does not delete anything when the source history is already within limit', async () => {
    const writer: IngestionErrorLogWriter = {
      ingestionError: {
        create: vi.fn().mockResolvedValue({
          id: '7eb45381-6b55-4692-8d54-f5893d71441d',
        }),
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const persistence = createIngestionErrorLogPersistence(writer);

    await persistence.pruneIngestionErrorsForSource(
      'dc0db0b4-5670-4285-8f4d-7ef4cf68af89',
      20,
    );

    assert.strictEqual(
      vi.mocked(writer.ingestionError.deleteMany).mock.calls.length,
      0,
    );
  });
});
