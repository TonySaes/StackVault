import { assert, describe, it, vi } from 'vitest';

import {
  buildGroupedSourceIngestionResult,
  buildGroupedSourceResultFromReport,
  createGroupedSourceIngestionDependencies,
  createGroupedSourceFailureRecorder,
  type CreateGroupedSourceIngestionDependencies,
  GROUPED_SOURCE_INGESTION_UNSUPPORTED_TYPE_ERROR,
  GROUPED_SOURCE_INGESTION_UNEXPECTED_ERROR,
  runGroupedSourceIngestion,
  type GroupedSourceIngestionReport,
  type GroupedSourceIngestionSource,
  type GroupedSourceIngestionSourceResult,
} from './grouped-source-ingestion.js';
import { type IngestionErrorLogPersistencePort } from './ingestion-error-log.js';

const sourceResults: GroupedSourceIngestionSourceResult[] = [
  {
    source: {
      id: 'c91049ab-4b8a-4142-a8fb-b9a8183bff4d',
      name: 'React Blog',
      url: 'https://react.dev/blog',
      type: 'rss_atom',
      status: 'active',
    },
    status: 'succeeded',
    createdCount: 1,
    updatedCount: 0,
    skippedCount: 0,
    recordedErrorCount: 0,
    errors: [],
  },
  {
    source: {
      id: 'f55f6f25-7ad0-4c6c-a908-ac8616f70862',
      name: 'Broken Source',
      url: 'https://example.invalid/feed',
      type: 'rss_atom',
      status: 'active',
    },
    status: 'failed',
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    recordedErrorCount: 1,
    errors: [{ code: 'source.ingestionFailed', field: 'source' }],
  },
];

function createFactoryDependencies(
  runners: CreateGroupedSourceIngestionDependencies['runners'],
): CreateGroupedSourceIngestionDependencies {
  const dependencies: CreateGroupedSourceIngestionDependencies = {
    fetchFeed: vi.fn(),
    fetchPage: vi.fn(),
    normalizationContext: {
      sources: [],
      categories: [],
      technologies: [],
      fallbackCategorySlug: 'trend',
    },
    persistence: {
      upsertResourceDraft: vi.fn(),
    },
    errorLog: {
      persistence: {
        createIngestionError: vi.fn().mockResolvedValue({
          ingestionErrorId: '7eb45381-6b55-4692-8d54-f5893d71441d',
        }),
        pruneIngestionErrorsForSource: vi.fn().mockResolvedValue(undefined),
      },
    },
  };

  if (runners) {
    dependencies.runners = runners;
  }

  return dependencies;
}

describe('buildGroupedSourceIngestionResult', () => {
  it('summarizes source-level results without changing their order', () => {
    const result = buildGroupedSourceIngestionResult(sourceResults);

    assert.deepEqual(result, {
      processedSourceCount: 2,
      succeededSourceCount: 1,
      failedSourceCount: 1,
      sources: sourceResults,
    });
  });

  it('returns zero counters for an empty source list', () => {
    const result = buildGroupedSourceIngestionResult([]);

    assert.deepEqual(result, {
      processedSourceCount: 0,
      succeededSourceCount: 0,
      failedSourceCount: 0,
      sources: [],
    });
  });
});

describe('buildGroupedSourceResultFromReport', () => {
  it('maps a successful ingestion report to a successful source result', () => {
    const source = sourceResults[0]?.source;
    const report: GroupedSourceIngestionReport = {
      adapter: {
        entries: [{ errors: [] }],
      },
      ingestion: {
        createdCount: 1,
        updatedCount: 2,
        skippedCount: 0,
        items: [{ errors: [] }],
      },
    };

    assert.ok(source);
    assert.deepEqual(buildGroupedSourceResultFromReport(source, report, 0), {
      source,
      status: 'succeeded',
      createdCount: 1,
      updatedCount: 2,
      skippedCount: 0,
      recordedErrorCount: 0,
      errors: [],
    });
  });

  it('maps adapter and ingestion errors to a failed source result', () => {
    const source = sourceResults[1]?.source;
    const report: GroupedSourceIngestionReport = {
      adapter: {
        entries: [
          {
            errors: [{ code: 'feed.fetchFailed', field: 'fetchFeed' }],
          },
        ],
      },
      ingestion: {
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 1,
        items: [
          {
            errors: [{ code: 'persistence.failed', field: 'persistence' }],
          },
        ],
      },
    };

    assert.ok(source);
    assert.deepEqual(buildGroupedSourceResultFromReport(source, report, 2), {
      source,
      status: 'failed',
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 1,
      recordedErrorCount: 2,
      errors: [
        { code: 'feed.fetchFailed', field: 'fetchFeed' },
        { code: 'persistence.failed', field: 'persistence' },
      ],
    });
  });

  it('keeps warning-only reports successful even when items are skipped', () => {
    const source = sourceResults[0]?.source;
    const report: GroupedSourceIngestionReport = {
      adapter: {
        entries: [
          {
            warnings: [{ code: 'metadata.summaryMissing', field: 'summary' }],
            errors: [],
          },
        ],
      },
      ingestion: {
        createdCount: 0,
        updatedCount: 1,
        skippedCount: 1,
        items: [
          {
            warnings: [
              { code: 'canonicalUrl.duplicate', field: 'canonicalUrl' },
            ],
            errors: [],
          },
        ],
      },
    };

    assert.ok(source);
    assert.deepEqual(buildGroupedSourceResultFromReport(source, report, 0), {
      source,
      status: 'succeeded',
      createdCount: 0,
      updatedCount: 1,
      skippedCount: 1,
      recordedErrorCount: 0,
      errors: [],
    });
  });
});

describe('runGroupedSourceIngestion', () => {
  it('runs source ingestion sequentially and returns the grouped summary', async () => {
    const reactSource: GroupedSourceIngestionSource = {
      id: 'c91049ab-4b8a-4142-a8fb-b9a8183bff4d',
      name: 'React Blog',
      url: 'https://react.dev/blog',
      type: 'rss_atom',
      status: 'active',
    };
    const nodeSource: GroupedSourceIngestionSource = {
      id: 'a6e01d7d-bba3-45d6-972b-7e69729c78c7',
      name: 'Node.js Blog',
      url: 'https://nodejs.org/en/blog',
      type: 'public_metadata',
      status: 'active',
    };
    const sources: GroupedSourceIngestionSource[] = [reactSource, nodeSource];
    const runOrder: string[] = [];
    const runSourceIngestion = vi
      .fn()
      .mockImplementation(async (source: GroupedSourceIngestionSource) => {
        runOrder.push(source.name);

        return {
          source,
          status: 'succeeded',
          createdCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          recordedErrorCount: 0,
          errors: [],
        } satisfies GroupedSourceIngestionSourceResult;
      });
    const recordSourceFailure = vi.fn().mockResolvedValue(1);

    const result = await runGroupedSourceIngestion(sources, {
      runSourceIngestion,
      recordSourceFailure,
    });

    assert.deepEqual(runOrder, ['React Blog', 'Node.js Blog']);
    assert.deepEqual(
      vi.mocked(runSourceIngestion).mock.calls.map(([source]) => source.name),
      ['React Blog', 'Node.js Blog'],
    );
    assert.strictEqual(vi.mocked(recordSourceFailure).mock.calls.length, 0);
    assert.deepEqual(result, {
      processedSourceCount: 2,
      succeededSourceCount: 2,
      failedSourceCount: 0,
      sources: [
        {
          source: reactSource,
          status: 'succeeded',
          createdCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          recordedErrorCount: 0,
          errors: [],
        },
        {
          source: nodeSource,
          status: 'succeeded',
          createdCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          recordedErrorCount: 0,
          errors: [],
        },
      ],
    });
  });

  it('isolates a thrown source failure and continues with the next source', async () => {
    const brokenSource: GroupedSourceIngestionSource = {
      id: 'f55f6f25-7ad0-4c6c-a908-ac8616f70862',
      name: 'Broken Source',
      url: 'https://example.invalid/feed',
      type: 'rss_atom',
      status: 'active',
    };
    const nodeSource: GroupedSourceIngestionSource = {
      id: 'a6e01d7d-bba3-45d6-972b-7e69729c78c7',
      name: 'Node.js Blog',
      url: 'https://nodejs.org/en/blog',
      type: 'public_metadata',
      status: 'active',
    };
    const runSourceIngestion = vi
      .fn()
      .mockRejectedValueOnce(new Error('raw provider failure'))
      .mockResolvedValueOnce({
        source: nodeSource,
        status: 'succeeded',
        createdCount: 1,
        updatedCount: 0,
        skippedCount: 0,
        recordedErrorCount: 0,
        errors: [],
      } satisfies GroupedSourceIngestionSourceResult);
    const recordSourceFailure = vi.fn().mockResolvedValue(1);

    const result = await runGroupedSourceIngestion(
      [brokenSource, nodeSource],
      {
        runSourceIngestion,
        recordSourceFailure,
      },
    );

    assert.deepEqual(
      vi.mocked(runSourceIngestion).mock.calls.map(([source]) => source.name),
      ['Broken Source', 'Node.js Blog'],
    );
    assert.deepEqual(vi.mocked(recordSourceFailure).mock.calls, [
      [
        brokenSource,
        {
          code: GROUPED_SOURCE_INGESTION_UNEXPECTED_ERROR,
          field: 'source',
        },
      ],
    ]);
    assert.deepEqual(result, {
      processedSourceCount: 2,
      succeededSourceCount: 1,
      failedSourceCount: 1,
      sources: [
        {
          source: brokenSource,
          status: 'failed',
          createdCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          recordedErrorCount: 1,
          errors: [
            {
              code: GROUPED_SOURCE_INGESTION_UNEXPECTED_ERROR,
              field: 'source',
            },
          ],
        },
        {
          source: nodeSource,
          status: 'succeeded',
          createdCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          recordedErrorCount: 0,
          errors: [],
        },
      ],
    });
  });

  it('keeps the source failure isolated when error recording also fails', async () => {
    const brokenSource: GroupedSourceIngestionSource = {
      id: 'f55f6f25-7ad0-4c6c-a908-ac8616f70862',
      name: 'Broken Source',
      url: 'https://example.invalid/feed',
      type: 'rss_atom',
      status: 'active',
    };
    const nodeSource: GroupedSourceIngestionSource = {
      id: 'a6e01d7d-bba3-45d6-972b-7e69729c78c7',
      name: 'Node.js Blog',
      url: 'https://nodejs.org/en/blog',
      type: 'public_metadata',
      status: 'active',
    };
    const runSourceIngestion = vi
      .fn()
      .mockRejectedValueOnce(new Error('raw provider failure'))
      .mockResolvedValueOnce({
        source: nodeSource,
        status: 'succeeded',
        createdCount: 1,
        updatedCount: 0,
        skippedCount: 0,
        recordedErrorCount: 0,
        errors: [],
      } satisfies GroupedSourceIngestionSourceResult);
    const recordSourceFailure = vi
      .fn()
      .mockRejectedValueOnce(new Error('database unavailable'));

    const result = await runGroupedSourceIngestion(
      [brokenSource, nodeSource],
      {
        runSourceIngestion,
        recordSourceFailure,
      },
    );

    assert.deepEqual(
      vi.mocked(runSourceIngestion).mock.calls.map(([source]) => source.name),
      ['Broken Source', 'Node.js Blog'],
    );
    assert.deepEqual(result.sources[0], {
      source: brokenSource,
      status: 'failed',
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      recordedErrorCount: 0,
      errors: [
        {
          code: GROUPED_SOURCE_INGESTION_UNEXPECTED_ERROR,
          field: 'source',
        },
      ],
    });
    assert.strictEqual(result.succeededSourceCount, 1);
    assert.strictEqual(result.failedSourceCount, 1);
  });

  it('isolates an unsupported source type without calling source ingestion', async () => {
    const unsupportedSource: GroupedSourceIngestionSource = {
      id: 'd342f4f3-21e5-48dd-b1ab-a062d953558d',
      name: 'Unsupported Source',
      url: 'https://example.invalid/source',
      type: 'unknown_type',
      status: 'active',
    };
    const nodeSource: GroupedSourceIngestionSource = {
      id: 'a6e01d7d-bba3-45d6-972b-7e69729c78c7',
      name: 'Node.js Blog',
      url: 'https://nodejs.org/en/blog',
      type: 'public_metadata',
      status: 'active',
    };
    const runSourceIngestion = vi.fn().mockResolvedValue({
      source: nodeSource,
      status: 'succeeded',
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      recordedErrorCount: 0,
      errors: [],
    } satisfies GroupedSourceIngestionSourceResult);
    const recordSourceFailure = vi.fn().mockResolvedValue(1);
    const isSourceTypeSupported = vi
      .fn()
      .mockImplementation(
        (source: GroupedSourceIngestionSource) =>
          source.type === 'rss_atom' || source.type === 'public_metadata',
      );

    const result = await runGroupedSourceIngestion(
      [unsupportedSource, nodeSource],
      {
        runSourceIngestion,
        recordSourceFailure,
        isSourceTypeSupported,
      },
    );

    assert.deepEqual(
      vi.mocked(runSourceIngestion).mock.calls.map(([source]) => source.name),
      ['Node.js Blog'],
    );
    assert.deepEqual(vi.mocked(recordSourceFailure).mock.calls, [
      [
        unsupportedSource,
        {
          code: GROUPED_SOURCE_INGESTION_UNSUPPORTED_TYPE_ERROR,
          field: 'type',
        },
      ],
    ]);
    assert.deepEqual(result, {
      processedSourceCount: 2,
      succeededSourceCount: 1,
      failedSourceCount: 1,
      sources: [
        {
          source: unsupportedSource,
          status: 'failed',
          createdCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          recordedErrorCount: 1,
          errors: [
            {
              code: GROUPED_SOURCE_INGESTION_UNSUPPORTED_TYPE_ERROR,
              field: 'type',
            },
          ],
        },
        {
          source: nodeSource,
          status: 'succeeded',
          createdCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          recordedErrorCount: 0,
          errors: [],
        },
      ],
    });
  });

  it('isolates a source type guard failure and continues with the next source', async () => {
    const brokenSource: GroupedSourceIngestionSource = {
      id: 'd342f4f3-21e5-48dd-b1ab-a062d953558d',
      name: 'Broken Source Guard',
      url: 'https://example.invalid/source',
      type: 'rss_atom',
      status: 'active',
    };
    const nodeSource: GroupedSourceIngestionSource = {
      id: 'a6e01d7d-bba3-45d6-972b-7e69729c78c7',
      name: 'Node.js Blog',
      url: 'https://nodejs.org/en/blog',
      type: 'public_metadata',
      status: 'active',
    };
    const runSourceIngestion = vi.fn().mockResolvedValue({
      source: nodeSource,
      status: 'succeeded',
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      recordedErrorCount: 0,
      errors: [],
    } satisfies GroupedSourceIngestionSourceResult);
    const recordSourceFailure = vi.fn().mockResolvedValue(1);
    const isSourceTypeSupported = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('guard unavailable');
      })
      .mockReturnValueOnce(true);

    const result = await runGroupedSourceIngestion(
      [brokenSource, nodeSource],
      {
        runSourceIngestion,
        recordSourceFailure,
        isSourceTypeSupported,
      },
    );

    assert.deepEqual(
      vi.mocked(runSourceIngestion).mock.calls.map(([source]) => source.name),
      ['Node.js Blog'],
    );
    assert.deepEqual(vi.mocked(recordSourceFailure).mock.calls, [
      [
        brokenSource,
        {
          code: GROUPED_SOURCE_INGESTION_UNSUPPORTED_TYPE_ERROR,
          field: 'type',
        },
      ],
    ]);
    assert.deepEqual(result, {
      processedSourceCount: 2,
      succeededSourceCount: 1,
      failedSourceCount: 1,
      sources: [
        {
          source: brokenSource,
          status: 'failed',
          createdCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          recordedErrorCount: 1,
          errors: [
            {
              code: GROUPED_SOURCE_INGESTION_UNSUPPORTED_TYPE_ERROR,
              field: 'type',
            },
          ],
        },
        {
          source: nodeSource,
          status: 'succeeded',
          createdCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          recordedErrorCount: 0,
          errors: [],
        },
      ],
    });
  });
});

describe('createGroupedSourceIngestionDependencies', () => {
  it('routes rss_atom sources to the RSS Atom runner', async () => {
    const sourceResult = sourceResults[0];
    assert.ok(sourceResult);
    const source = sourceResult.source;
    const runRssAtomSource = vi.fn().mockResolvedValue({
      adapter: {
        entries: [{ errors: [] }],
      },
      ingestion: {
        createdCount: 1,
        updatedCount: 0,
        skippedCount: 0,
        items: [{ errors: [] }],
      },
    } satisfies GroupedSourceIngestionReport);
    const runPublicMetadataSource = vi.fn();
    const dependencies = createFactoryDependencies({
      runRssAtomSource,
      runPublicMetadataSource,
    });
    const groupedDependencies =
      createGroupedSourceIngestionDependencies(dependencies);

    const result = await groupedDependencies.runSourceIngestion(source);

    assert.strictEqual(groupedDependencies.isSourceTypeSupported?.(source), true);
    assert.strictEqual(runRssAtomSource.mock.calls.length, 1);
    assert.strictEqual(runRssAtomSource.mock.calls[0]?.[0], source);
    assert.strictEqual(runPublicMetadataSource.mock.calls.length, 0);
    assert.deepEqual(result, {
      source,
      status: 'succeeded',
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      recordedErrorCount: 0,
      errors: [],
    });
  });

  it('routes public_metadata sources to the public metadata runner', async () => {
    const source: GroupedSourceIngestionSource = {
      id: 'a6e01d7d-bba3-45d6-972b-7e69729c78c7',
      name: 'Node.js Blog',
      url: 'https://nodejs.org/en/blog',
      type: 'public_metadata',
      status: 'active',
    };
    const runRssAtomSource = vi.fn();
    const runPublicMetadataSource = vi.fn().mockResolvedValue({
      adapter: {
        entries: [{ errors: [] }],
      },
      ingestion: {
        createdCount: 0,
        updatedCount: 1,
        skippedCount: 0,
        items: [{ errors: [] }],
      },
    } satisfies GroupedSourceIngestionReport);
    const dependencies = createFactoryDependencies({
      runRssAtomSource,
      runPublicMetadataSource,
    });
    const groupedDependencies =
      createGroupedSourceIngestionDependencies(dependencies);

    const result = await groupedDependencies.runSourceIngestion(source);

    assert.strictEqual(groupedDependencies.isSourceTypeSupported?.(source), true);
    assert.strictEqual(runRssAtomSource.mock.calls.length, 0);
    assert.strictEqual(runPublicMetadataSource.mock.calls.length, 1);
    assert.strictEqual(runPublicMetadataSource.mock.calls[0]?.[0], source);
    assert.deepEqual(result, {
      source,
      status: 'succeeded',
      createdCount: 0,
      updatedCount: 1,
      skippedCount: 0,
      recordedErrorCount: 0,
      errors: [],
    });
  });

  it('records report errors through the ingestion error logger', async () => {
    const sourceResult = sourceResults[0];
    assert.ok(sourceResult);
    const source = sourceResult.source;
    const runRssAtomSource = vi.fn().mockResolvedValue({
      adapter: {
        entries: [
          {
            errors: [{ code: 'feed.fetchFailed', field: 'fetchFeed' }],
          },
        ],
      },
      ingestion: {
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        items: [{ errors: [] }],
      },
    } satisfies GroupedSourceIngestionReport);
    const dependencies = createFactoryDependencies({
      runRssAtomSource,
    });
    const groupedDependencies =
      createGroupedSourceIngestionDependencies(dependencies);

    const result = await groupedDependencies.runSourceIngestion(source);

    assert.strictEqual(result.status, 'failed');
    assert.strictEqual(result.recordedErrorCount, 1);
    assert.deepEqual(result.errors, [
      { code: 'feed.fetchFailed', field: 'fetchFeed' },
    ]);
    assert.deepEqual(
      vi.mocked(
        dependencies.errorLog.persistence.createIngestionError,
      ).mock.calls.map(([entry]) => ({
        errorType: entry.errorType,
        message: entry.message,
      })),
      [
        {
          errorType: 'feed.fetchFailed',
          message: 'RSS/Atom adapter error feed.fetchFailed on fetchFeed.',
        },
      ],
    );
  });

  it('keeps report errors when report error logging fails', async () => {
    const sourceResult = sourceResults[0];
    assert.ok(sourceResult);
    const source = sourceResult.source;
    const runRssAtomSource = vi.fn().mockResolvedValue({
      adapter: {
        entries: [
          {
            errors: [{ code: 'feed.fetchFailed', field: 'fetchFeed' }],
          },
        ],
      },
      ingestion: {
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        items: [{ errors: [] }],
      },
    } satisfies GroupedSourceIngestionReport);
    const dependencies = createFactoryDependencies({
      runRssAtomSource,
    });
    vi.mocked(
      dependencies.errorLog.persistence.createIngestionError,
    ).mockRejectedValueOnce(new Error('database unavailable'));
    const groupedDependencies =
      createGroupedSourceIngestionDependencies(dependencies);

    const result = await groupedDependencies.runSourceIngestion(source);

    assert.deepEqual(result, {
      source,
      status: 'failed',
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      recordedErrorCount: 0,
      errors: [{ code: 'feed.fetchFailed', field: 'fetchFeed' }],
    });
  });

  it('rejects direct factory runner calls for unsupported source types', async () => {
    const unsupportedSource: GroupedSourceIngestionSource = {
      id: 'd342f4f3-21e5-48dd-b1ab-a062d953558d',
      name: 'Unsupported Source',
      url: 'https://example.invalid/source',
      type: 'unknown_type',
      status: 'active',
    };
    const runRssAtomSource = vi.fn();
    const runPublicMetadataSource = vi.fn();
    const dependencies = createFactoryDependencies({
      runRssAtomSource,
      runPublicMetadataSource,
    });
    const groupedDependencies =
      createGroupedSourceIngestionDependencies(dependencies);

    const result =
      await groupedDependencies.runSourceIngestion(unsupportedSource);

    assert.strictEqual(runRssAtomSource.mock.calls.length, 0);
    assert.strictEqual(runPublicMetadataSource.mock.calls.length, 0);
    assert.deepEqual(result, {
      source: unsupportedSource,
      status: 'failed',
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      recordedErrorCount: 1,
      errors: [
        {
          code: GROUPED_SOURCE_INGESTION_UNSUPPORTED_TYPE_ERROR,
          field: 'type',
        },
      ],
    });
  });
});

describe('createGroupedSourceFailureRecorder', () => {
  it('records an isolated grouped source failure through the ingestion error logger', async () => {
    const persistence: IngestionErrorLogPersistencePort = {
      createIngestionError: vi.fn().mockResolvedValue({
        ingestionErrorId: '7eb45381-6b55-4692-8d54-f5893d71441d',
      }),
      pruneIngestionErrorsForSource: vi.fn().mockResolvedValue(undefined),
    };
    const recorder = createGroupedSourceFailureRecorder({ persistence });
    const source: GroupedSourceIngestionSource = {
      id: 'f55f6f25-7ad0-4c6c-a908-ac8616f70862',
      name: 'Broken Source',
      url: 'https://example.invalid/feed',
      type: 'rss_atom',
      status: 'active',
    };

    const recordedCount = await recorder(source, {
      code: GROUPED_SOURCE_INGESTION_UNEXPECTED_ERROR,
      field: 'source',
    });
    const createdEntry =
      vi.mocked(persistence.createIngestionError).mock.calls[0]?.[0];

    assert.strictEqual(recordedCount, 1);
    assert.ok(createdEntry);
    assert.strictEqual(createdEntry.sourceId, source.id);
    assert.strictEqual(
      createdEntry.errorType,
      GROUPED_SOURCE_INGESTION_UNEXPECTED_ERROR,
    );
    assert.strictEqual(
      createdEntry.message,
      'Grouped source ingestion error source.ingestionFailed on source.',
    );
    assert.strictEqual(createdEntry.sourceStatus, 'active');
    assert.ok(createdEntry.occurredAt instanceof Date);
    assert.deepEqual(
      vi.mocked(persistence.pruneIngestionErrorsForSource).mock.calls,
      [[source.id, 20]],
    );
  });
});
