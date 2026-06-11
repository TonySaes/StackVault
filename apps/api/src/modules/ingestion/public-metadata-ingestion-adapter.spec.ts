import { assert, describe, it, vi } from 'vitest';

import type {
  ManualDemoIngestionPersistencePort,
  ManualDemoIngestionPersistenceResult,
} from './manual-demo-ingestion.js';
import type { IngestionNormalizationContext } from './normalize-ingestion-item.js';
import {
  mapPublicMetadataPageToIngestionItem,
  parsePublicMetadataPage,
  PUBLIC_METADATA_SOURCE_TYPE,
  runPublicMetadataIngestion,
  runPublicMetadataIngestionAdapter,
  type PublicMetadataIngestionSource,
} from './public-metadata-ingestion-adapter.js';

const publicMetadataSource: PublicMetadataIngestionSource = {
  id: 'source-node-blog',
  name: 'Node.js Blog',
  url: 'https://nodejs.org/en/blog',
  defaultTechnology: 'Node.js',
  status: 'active',
  type: PUBLIC_METADATA_SOURCE_TYPE,
};

const normalizationContext: IngestionNormalizationContext = {
  sources: [
    {
      id: 'source-node-blog',
      name: 'Node.js Blog',
      url: 'https://nodejs.org/en/blog',
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
      id: 'technology-node-js',
      slug: 'node-js',
      name: 'Node.js',
      status: 'active',
    },
  ],
  fallbackCategorySlug: 'trend',
};

function createPersistencePort() {
  return {
    upsertResourceDraft: vi.fn(
      async (
        _draft: Parameters<
          ManualDemoIngestionPersistencePort['upsertResourceDraft']
        >[0],
      ): Promise<ManualDemoIngestionPersistenceResult> => ({
        resourceId: 'resource-node-blog',
        operation: 'created' as const,
      }),
    ),
  } satisfies ManualDemoIngestionPersistencePort;
}

describe('parsePublicMetadataPage', () => {
  it('extracts Open Graph metadata from a public HTML page', () => {
    const parsedPage = parsePublicMetadataPage(
      `<!doctype html>
<html lang="fr">
  <head>
    <meta property="og:title" content="Node.js releases security updates" />
    <meta property="og:description" content="Node.js publie des correctifs de securite." />
    <meta property="article:published_time" content="2025-05-14T00:00:00Z" />
  </head>
  <body><article>Full third-party body ignored by parser.</article></body>
</html>`,
      'https://nodejs.org/en/blog',
    );

    assert.deepEqual(parsedPage, {
      title: 'Node.js releases security updates',
      sourceUrl: 'https://nodejs.org/en/blog',
      publishedAt: '2025-05-14T00:00:00Z',
      summary: 'Node.js publie des correctifs de securite.',
    });
    assert.strictEqual(JSON.stringify(parsedPage).includes('Full third-party'), false);
  });

  it('falls back to title and description metadata without Open Graph tags', () => {
    const parsedPage = parsePublicMetadataPage(
      `<!doctype html>
<html>
  <head>
    <title>PostgreSQL News &amp; Events</title>
    <meta name="description" content="Actualites publiques autour de PostgreSQL." />
  </head>
</html>`,
      'https://www.postgresql.org/about/news/',
    );

    assert.deepEqual(parsedPage, {
      title: 'PostgreSQL News & Events',
      sourceUrl: 'https://www.postgresql.org/about/news/',
      publishedAt: null,
      summary: 'Actualites publiques autour de PostgreSQL.',
    });
  });

  it('cleans HTML fragments from metadata text before returning summaries', () => {
    const parsedPage = parsePublicMetadataPage(
      `<!doctype html>
<html>
  <head>
    <meta property="og:title" content="&lt;strong&gt;Prisma&lt;/strong&gt; update" />
    <meta name="description" content="&lt;p&gt;Prisma &amp; StackVault &lt;em&gt;restent lisibles&lt;/em&gt;.&lt;/p&gt;&lt;script&gt;alert('x')&lt;/script&gt;" />
  </head>
</html>`,
      'https://www.prisma.io/blog',
    );

    assert.strictEqual(parsedPage.title, 'Prisma update');
    assert.strictEqual(parsedPage.summary, 'Prisma & StackVault restent lisibles.');
    assert.strictEqual(JSON.stringify(parsedPage).includes('<script>'), false);
  });

  it('returns null metadata values when the page has no supported tags', () => {
    const parsedPage = parsePublicMetadataPage(
      '<html><head></head><body>No supported metadata.</body></html>',
      'https://example.com/source',
    );

    assert.deepEqual(parsedPage, {
      title: null,
      sourceUrl: 'https://example.com/source',
      publishedAt: null,
      summary: null,
    });
  });
});

describe('mapPublicMetadataPageToIngestionItem', () => {
  it('maps parsed public metadata to a single ingestion item', () => {
    const result = mapPublicMetadataPageToIngestionItem(publicMetadataSource, {
      title: 'Node.js releases security updates',
      sourceUrl: 'https://nodejs.org/en/blog',
      publishedAt: '2025-05-14T00:00:00Z',
      summary: 'Node.js publie des correctifs de securite.',
    });

    assert.deepEqual(result.items, [
      {
        title: 'Node.js releases security updates',
        sourceUrl: 'https://nodejs.org/en/blog',
        source: {
          name: 'Node.js Blog',
          url: 'https://nodejs.org/en/blog',
          type: PUBLIC_METADATA_SOURCE_TYPE,
        },
        candidateCategory: null,
        candidateTechnologies: ['Node.js'],
        publishedAt: '2025-05-14T00:00:00Z',
        shortSummary: 'Node.js publie des correctifs de securite.',
      },
    ]);
    assert.deepEqual(result.entries, [
      {
        title: 'Node.js releases security updates',
        sourceUrl: 'https://nodejs.org/en/blog',
        status: 'mapped',
        warnings: [
          {
            code: 'metadata.categoryMissing',
            field: 'candidateCategory',
          },
        ],
        errors: [],
      },
    ]);
  });

  it('keeps explicit warnings when optional metadata is absent', () => {
    const { defaultTechnology: _defaultTechnology, ...sourceWithoutDefault } =
      publicMetadataSource;

    const result = mapPublicMetadataPageToIngestionItem(sourceWithoutDefault, {
      title: 'PostgreSQL News',
      sourceUrl: 'https://www.postgresql.org/about/news/',
      publishedAt: null,
      summary: null,
    });

    assert.strictEqual(result.items.length, 1);
    assert.deepEqual(result.items[0]?.candidateTechnologies, []);
    assert.deepEqual(result.entries[0]?.warnings, [
      { code: 'metadata.categoryMissing', field: 'candidateCategory' },
      {
        code: 'metadata.technologyMissing',
        field: 'candidateTechnologies',
      },
      { code: 'metadata.summaryMissing', field: 'summary' },
      { code: 'metadata.publishedAtMissing', field: 'publishedAt' },
    ]);
  });

  it('rejects pages without a title before creating ingestion items', () => {
    const result = mapPublicMetadataPageToIngestionItem(publicMetadataSource, {
      title: null,
      sourceUrl: 'https://nodejs.org/en/blog',
      publishedAt: null,
      summary: null,
    });

    assert.deepEqual(result.items, []);
    assert.deepEqual(result.entries[0]?.errors, [
      { code: 'metadata.titleMissing', field: 'title' },
    ]);
  });

  it('rejects titles that exceed the persisted Resource title limit', () => {
    const result = mapPublicMetadataPageToIngestionItem(publicMetadataSource, {
      title: 'a'.repeat(241),
      sourceUrl: 'https://nodejs.org/en/blog',
      publishedAt: null,
      summary: null,
    });

    assert.deepEqual(result.items, []);
    assert.deepEqual(result.entries[0]?.errors, [
      { code: 'metadata.titleTooLong', field: 'title' },
    ]);
  });

  it('rejects summaries that are too long to stay short', () => {
    const result = mapPublicMetadataPageToIngestionItem(publicMetadataSource, {
      title: 'Long public metadata summary',
      sourceUrl: 'https://nodejs.org/en/blog',
      publishedAt: null,
      summary: 'a'.repeat(501),
    });

    assert.deepEqual(result.items, []);
    assert.deepEqual(result.entries[0]?.errors, [
      { code: 'metadata.summaryTooLong', field: 'summary' },
    ]);
  });
});

describe('runPublicMetadataIngestionAdapter', () => {
  it('fetches an active public metadata source and maps it to one ingestion item', async () => {
    const fetchedUrls: string[] = [];

    const result = await runPublicMetadataIngestionAdapter(publicMetadataSource, {
      fetchPage: async (sourceUrl) => {
        fetchedUrls.push(sourceUrl);

        return `<!doctype html>
<html>
  <head>
    <meta property="og:title" content="Node.js public metadata" />
    <meta property="og:description" content="Signal public issu des metadonnees." />
  </head>
</html>`;
      },
    });

    assert.deepEqual(fetchedUrls, ['https://nodejs.org/en/blog']);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0]?.title, 'Node.js public metadata');
    assert.deepEqual(result.entries[0]?.errors, []);
  });

  it('rejects inactive sources before fetching the public page', async () => {
    let fetchCalls = 0;

    const result = await runPublicMetadataIngestionAdapter(
      {
        ...publicMetadataSource,
        status: 'inactive',
      },
      {
        fetchPage: async () => {
          fetchCalls += 1;

          return '<html></html>';
        },
      },
    );

    assert.strictEqual(fetchCalls, 0);
    assert.deepEqual(result.items, []);
    assert.deepEqual(result.entries[0]?.errors, [
      { code: 'source.inactive', field: 'status' },
    ]);
  });

  it('rejects unsupported source types before fetching the public page', async () => {
    let fetchCalls = 0;

    const result = await runPublicMetadataIngestionAdapter(
      {
        ...publicMetadataSource,
        type: 'rss_atom',
      },
      {
        fetchPage: async () => {
          fetchCalls += 1;

          return '<html></html>';
        },
      },
    );

    assert.strictEqual(fetchCalls, 0);
    assert.deepEqual(result.items, []);
    assert.deepEqual(result.entries[0]?.errors, [
      { code: 'source.typeUnsupported', field: 'type' },
    ]);
  });

  it('reports fetch failures without leaking third-party payloads', async () => {
    const result = await runPublicMetadataIngestionAdapter(publicMetadataSource, {
      fetchPage: async () => {
        throw new Error('external provider payload with private details');
      },
    });

    assert.deepEqual(result.items, []);
    assert.deepEqual(result.entries[0]?.errors, [
      { code: 'page.fetchFailed', field: 'url' },
    ]);
    assert.strictEqual(
      JSON.stringify(result).includes('external provider payload'),
      false,
    );
  });
});

describe('runPublicMetadataIngestion', () => {
  it('passes public metadata items through validation, normalization and persistence', async () => {
    const fetchPage = vi.fn(async () => `<!doctype html>
<html>
  <head>
    <meta property="og:title" content="Node.js public metadata" />
    <meta property="og:description" content="Signal public issu des metadonnees." />
    <meta property="article:published_time" content="2025-05-14T00:00:00Z" />
  </head>
</html>`);
    const persistence = createPersistencePort();

    const result = await runPublicMetadataIngestion(publicMetadataSource, {
      fetchPage,
      normalizationContext,
      persistence,
    });

    assert.strictEqual(fetchPage.mock.calls.length, 1);
    assert.strictEqual(persistence.upsertResourceDraft.mock.calls.length, 1);
    assert.deepEqual(persistence.upsertResourceDraft.mock.calls[0]?.[0], {
      sourceId: 'source-node-blog',
      categoryId: 'category-trend',
      title: 'Node.js public metadata',
      sourceUrl: 'https://nodejs.org/en/blog',
      canonicalUrl: 'https://nodejs.org/en/blog',
      publishedAt: new Date('2025-05-14T00:00:00Z'),
      shortSummary: 'Signal public issu des metadonnees.',
      lifecycleStatus: 'active',
      linkStatus: 'unknown',
      technologyIds: ['technology-node-js'],
    });
    assert.deepEqual(result.ingestion, {
      processedCount: 1,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      items: [
        {
          title: 'Node.js public metadata',
          sourceUrl: 'https://nodejs.org/en/blog',
          status: 'created',
          canonicalUrl: 'https://nodejs.org/en/blog',
          resourceId: 'resource-node-blog',
          warnings: [],
          errors: [],
        },
      ],
    });
  });

  it('keeps the same canonical URL across two runs for the same public metadata source', async () => {
    const fetchPage = vi.fn(async () => `<!doctype html>
<html>
  <head>
    <meta property="og:title" content="Node.js public metadata" />
    <meta property="og:description" content="Signal public issu des metadonnees." />
  </head>
</html>`);
    const persistence = {
      upsertResourceDraft: vi
        .fn(
          async (
            _draft: Parameters<
              ManualDemoIngestionPersistencePort['upsertResourceDraft']
            >[0],
          ): Promise<ManualDemoIngestionPersistenceResult> => ({
            resourceId: 'resource-node-blog',
            operation: 'created' as const,
          }),
        )
        .mockResolvedValueOnce({
          resourceId: 'resource-node-blog',
          operation: 'created' as const,
        })
        .mockResolvedValueOnce({
          resourceId: 'resource-node-blog',
          operation: 'updated' as const,
        }),
    } satisfies ManualDemoIngestionPersistencePort;

    const firstRun = await runPublicMetadataIngestion(publicMetadataSource, {
      fetchPage,
      normalizationContext,
      persistence,
    });
    const secondRun = await runPublicMetadataIngestion(publicMetadataSource, {
      fetchPage,
      normalizationContext,
      persistence,
    });

    assert.strictEqual(fetchPage.mock.calls.length, 2);
    assert.deepEqual(
      persistence.upsertResourceDraft.mock.calls.map(
        ([draft]) => draft.canonicalUrl,
      ),
      ['https://nodejs.org/en/blog', 'https://nodejs.org/en/blog'],
    );
    assert.strictEqual(firstRun.ingestion.createdCount, 1);
    assert.strictEqual(firstRun.ingestion.updatedCount, 0);
    assert.strictEqual(secondRun.ingestion.createdCount, 0);
    assert.strictEqual(secondRun.ingestion.updatedCount, 1);
  });
});
