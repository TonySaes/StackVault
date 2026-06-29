import { assert, describe, it, vi } from 'vitest';

import {
  buildGroupedSourceIngestionResult,
  GROUPED_SOURCE_INGESTION_UNEXPECTED_ERROR,
  runGroupedSourceIngestion,
  type GroupedSourceIngestionSource,
  type GroupedSourceIngestionSourceResult,
} from './grouped-source-ingestion.js';

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
});
