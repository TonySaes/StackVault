import { assert, describe, it, vi } from 'vitest';

import type { IngestionItem } from './ingestion-item.js';
import { runManualDemoIngestion } from './manual-demo-ingestion.js';
import type { ManualDemoIngestionPersistencePort } from './manual-demo-ingestion.js';
import type { IngestionNormalizationContext } from './normalize-ingestion-item.js';

const validIngestionItem: IngestionItem = {
  title: 'React Compiler release candidate',
  sourceUrl:
    'https://react.dev/blog/2025/04/21/react-compiler-rc/?utm_source=newsletter#details',
  source: {
    name: 'React Blog',
    url: 'https://react.dev/blog',
    type: 'public_metadata',
  },
  candidateCategory: 'release',
  candidateTechnologies: ['React'],
  publishedAt: '2025-04-21T00:00:00.000Z',
  shortSummary: 'Le compilateur React progresse vers une adoption stable.',
};

const normalizationContext: IngestionNormalizationContext = {
  sources: [
    {
      id: 'source-react-blog',
      name: 'React Blog',
      url: 'https://react.dev/blog',
      status: 'active',
    },
  ],
  categories: [
    {
      id: 'category-release',
      slug: 'release',
      name: 'Release',
    },
    {
      id: 'category-trend',
      slug: 'trend',
      name: 'Trend',
    },
  ],
  technologies: [
    {
      id: 'technology-react',
      slug: 'react',
      name: 'React',
      status: 'active',
    },
  ],
  fallbackCategorySlug: 'trend',
};

function createPersistencePort() {
  return {
    upsertResourceDraft: vi.fn(async () => ({
      resourceId: 'resource-react-compiler',
      operation: 'created' as const,
    })),
  } satisfies ManualDemoIngestionPersistencePort;
}

describe('runManualDemoIngestion', () => {
  it('validates, normalizes and persists valid items through the injected port', async () => {
    const persistence = createPersistencePort();

    const report = await runManualDemoIngestion([validIngestionItem], {
      normalizationContext,
      persistence,
    });

    assert.strictEqual(persistence.upsertResourceDraft.mock.calls.length, 1);
    assert.deepEqual(report, {
      processedCount: 1,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      items: [
        {
          title: validIngestionItem.title,
          sourceUrl: validIngestionItem.sourceUrl,
          status: 'created',
          canonicalUrl:
            'https://react.dev/blog/2025/04/21/react-compiler-rc',
          resourceId: 'resource-react-compiler',
          warnings: [],
          errors: [],
        },
      ],
    });
  });

  it('skips invalid items before persistence and reports non-sensitive validation errors', async () => {
    const persistence = createPersistencePort();

    const report = await runManualDemoIngestion(
      [
        {
          ...validIngestionItem,
          rawContent: '<article>Full third-party content</article>',
        },
      ],
      {
        normalizationContext,
        persistence,
      },
    );

    assert.strictEqual(persistence.upsertResourceDraft.mock.calls.length, 0);
    assert.strictEqual(report.skippedCount, 1);
    assert.deepEqual(report.items[0]?.errors, [
      {
        code: 'thirdPartyBody.forbidden',
        field: 'rawContent',
      },
    ]);
  });

  it('deduplicates canonical URLs during a single manual run', async () => {
    const persistence = createPersistencePort();

    const report = await runManualDemoIngestion(
      [
        validIngestionItem,
        {
          ...validIngestionItem,
          sourceUrl:
            'https://react.dev/blog/2025/04/21/react-compiler-rc?utm_campaign=duplicate',
        },
      ],
      {
        normalizationContext,
        persistence,
      },
    );

    assert.strictEqual(persistence.upsertResourceDraft.mock.calls.length, 1);
    assert.strictEqual(report.createdCount, 1);
    assert.strictEqual(report.skippedCount, 1);
    assert.deepEqual(report.items[1]?.warnings, [
      {
        code: 'canonicalUrl.duplicate',
        field: 'canonicalUrl',
      },
    ]);
  });

  it('skips items that cannot be normalized before persistence', async () => {
    const persistence = createPersistencePort();

    const report = await runManualDemoIngestion([validIngestionItem], {
      normalizationContext: {
        ...normalizationContext,
        sources: [],
      },
      persistence,
    });

    assert.strictEqual(persistence.upsertResourceDraft.mock.calls.length, 0);
    assert.strictEqual(report.skippedCount, 1);
    assert.deepEqual(report.items[0]?.errors, [
      {
        code: 'source.notAllowlisted',
        field: 'source',
      },
    ]);
  });
});
