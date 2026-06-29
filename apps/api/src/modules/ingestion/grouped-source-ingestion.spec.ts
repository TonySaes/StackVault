import { assert, describe, it } from 'vitest';

import {
  buildGroupedSourceIngestionResult,
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
