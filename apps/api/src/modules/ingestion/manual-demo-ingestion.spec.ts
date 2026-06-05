import { assert, describe, it, vi } from 'vitest';

import type { IngestionItem } from './ingestion-item.js';
import {
  createManualDemoIngestionPersistence,
  loadManualDemoIngestionContext,
  runManualDemoIngestion,
} from './manual-demo-ingestion.js';
import type {
  ManualDemoIngestionCatalogReader,
  ManualDemoIngestionPersistencePort,
  ManualDemoIngestionResourceWriter,
} from './manual-demo-ingestion.js';
import type {
  IngestionNormalizationContext,
  NormalizedResourceDraft,
} from './normalize-ingestion-item.js';

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

const normalizedResourceDraft: NormalizedResourceDraft = {
  sourceId: 'source-react-blog',
  categoryId: 'category-release',
  title: 'React Compiler release candidate',
  sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
  canonicalUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
  publishedAt: new Date('2025-04-21T00:00:00.000Z'),
  shortSummary: 'Le compilateur React progresse vers une adoption stable.',
  lifecycleStatus: 'active',
  linkStatus: 'unknown',
  technologyIds: ['technology-react'],
};

function createPersistencePort() {
  return {
    upsertResourceDraft: vi.fn(async () => ({
      resourceId: 'resource-react-compiler',
      operation: 'created' as const,
    })),
  } satisfies ManualDemoIngestionPersistencePort;
}

function createResourceWriter(existingResourceId: string | null = null) {
  return {
    resource: {
      findUnique: vi.fn(
        async (
          _args: Parameters<
            ManualDemoIngestionResourceWriter['resource']['findUnique']
          >[0],
        ) => (existingResourceId ? { id: existingResourceId } : null),
      ),
      upsert: vi.fn(
        async (
          _args: Parameters<
            ManualDemoIngestionResourceWriter['resource']['upsert']
          >[0],
        ) => ({
          id: existingResourceId ?? 'resource-react-compiler',
        }),
      ),
    },
  } satisfies ManualDemoIngestionResourceWriter;
}

function createCatalogReader() {
  return {
    source: {
      findMany: vi.fn(
        async (
          _args: Parameters<
            ManualDemoIngestionCatalogReader['source']['findMany']
          >[0],
        ) => [
          {
            id: 'source-react-blog',
            name: 'React Blog',
            url: 'https://react.dev/blog',
            status: 'active',
          },
        ],
      ),
    },
    category: {
      findMany: vi.fn(
        async (
          _args: Parameters<
            ManualDemoIngestionCatalogReader['category']['findMany']
          >[0],
        ) => [
          {
            id: 'category-trend',
            slug: 'trend',
            name: 'Trend',
          },
        ],
      ),
    },
    technology: {
      findMany: vi.fn(
        async (
          _args: Parameters<
            ManualDemoIngestionCatalogReader['technology']['findMany']
          >[0],
        ) => [
          {
            id: 'technology-react',
            slug: 'react',
            name: 'React',
            status: 'active',
          },
        ],
      ),
    },
  } satisfies ManualDemoIngestionCatalogReader;
}

describe('loadManualDemoIngestionContext', () => {
  it('loads active sources, categories and active technologies for normalization', async () => {
    const catalog = createCatalogReader();

    const context = await loadManualDemoIngestionContext(catalog);

    assert.deepEqual(catalog.source.findMany.mock.calls[0]?.[0], {
      where: {
        status: 'active',
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        url: true,
        status: true,
      },
    });
    assert.deepEqual(catalog.category.findMany.mock.calls[0]?.[0], {
      orderBy: {
        slug: 'asc',
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });
    assert.deepEqual(catalog.technology.findMany.mock.calls[0]?.[0], {
      where: {
        status: 'active',
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
      },
    });
    assert.deepEqual(context, {
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
    });
  });
});

describe('createManualDemoIngestionPersistence', () => {
  it('upserts a public resource by canonical URL and reports creation', async () => {
    const writer = createResourceWriter();
    const persistence = createManualDemoIngestionPersistence(writer);

    const result =
      await persistence.upsertResourceDraft(normalizedResourceDraft);

    assert.deepEqual(writer.resource.findUnique.mock.calls[0]?.[0], {
      where: {
        canonicalUrl:
          'https://react.dev/blog/2025/04/21/react-compiler-rc',
      },
      select: {
        id: true,
      },
    });
    assert.deepEqual(writer.resource.upsert.mock.calls[0]?.[0], {
      where: {
        canonicalUrl:
          'https://react.dev/blog/2025/04/21/react-compiler-rc',
      },
      update: {
        sourceId: 'source-react-blog',
        categoryId: 'category-release',
        title: 'React Compiler release candidate',
        sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
        publishedAt: new Date('2025-04-21T00:00:00.000Z'),
        shortSummary: 'Le compilateur React progresse vers une adoption stable.',
        lifecycleStatus: 'active',
        linkStatus: 'unknown',
      },
      create: {
        sourceId: 'source-react-blog',
        categoryId: 'category-release',
        title: 'React Compiler release candidate',
        sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
        canonicalUrl:
          'https://react.dev/blog/2025/04/21/react-compiler-rc',
        publishedAt: new Date('2025-04-21T00:00:00.000Z'),
        shortSummary: 'Le compilateur React progresse vers une adoption stable.',
        lifecycleStatus: 'active',
        linkStatus: 'unknown',
      },
      select: {
        id: true,
      },
    });
    assert.deepEqual(result, {
      resourceId: 'resource-react-compiler',
      operation: 'created',
    });
  });

  it('reports update when the canonical URL already exists', async () => {
    const writer = createResourceWriter('existing-resource');
    const persistence = createManualDemoIngestionPersistence(writer);

    const result =
      await persistence.upsertResourceDraft(normalizedResourceDraft);

    assert.deepEqual(result, {
      resourceId: 'existing-resource',
      operation: 'updated',
    });
  });
});

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
