import { assert, describe, it, vi } from 'vitest';

import {
  mapRssAtomEntriesToIngestionItems,
  parseRssAtomFeedEntries,
  runRssAtomIngestion,
  runRssAtomIngestionAdapter,
  RSS_ATOM_SOURCE_TYPE,
  type RssAtomIngestionSource,
  type RssAtomParsedFeedEntry,
} from './rss-atom-ingestion-adapter.js';
import type { ManualDemoIngestionPersistencePort } from './manual-demo-ingestion.js';
import type { IngestionNormalizationContext } from './normalize-ingestion-item.js';

const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>StackVault RSS Fixture</title>
    <item>
      <title>React Compiler release candidate</title>
      <link>https://react.dev/blog/2025/04/21/react-compiler-rc</link>
      <pubDate>Mon, 21 Apr 2025 00:00:00 GMT</pubDate>
      <description>Le compilateur React progresse vers une adoption stable.</description>
      <category>React</category>
      <category>release</category>
      <content:encoded><![CDATA[<article>Full body ignored by parser.</article>]]></content:encoded>
    </item>
  </channel>
</rss>`;

const atomFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>StackVault Atom Fixture</title>
  <entry>
    <title>Node.js security release</title>
    <link rel="alternate" href="https://nodejs.org/en/blog/vulnerability/example-release" />
    <updated>2025-05-14T00:00:00Z</updated>
    <summary>Node.js publie des correctifs de securite pour les versions supportees.</summary>
    <category term="Node.js" />
    <category term="security" />
    <content type="html">&lt;article&gt;Full body ignored by parser.&lt;/article&gt;</content>
  </entry>
</feed>`;

const rssAtomSource: RssAtomIngestionSource = {
  id: 'source-react-blog',
  name: 'React Blog',
  url: 'https://react.dev/blog',
  feedUrl: 'https://react.dev/rss.xml',
  defaultTechnology: 'React',
  status: 'active',
  type: RSS_ATOM_SOURCE_TYPE,
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

describe('parseRssAtomFeedEntries', () => {
  it('extracts metadata from RSS entries without carrying full content bodies', () => {
    const entries = parseRssAtomFeedEntries(rssFeed);

    assert.deepEqual(entries, [
      {
        title: 'React Compiler release candidate',
        sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
        publishedAt: 'Mon, 21 Apr 2025 00:00:00 GMT',
        summary: 'Le compilateur React progresse vers une adoption stable.',
        categories: ['React', 'release'],
      },
    ]);
    assert.strictEqual(JSON.stringify(entries).includes('Full body'), false);
  });

  it('extracts metadata from Atom entries without carrying full content bodies', () => {
    const entries = parseRssAtomFeedEntries(atomFeed);

    assert.deepEqual(entries, [
      {
        title: 'Node.js security release',
        sourceUrl:
          'https://nodejs.org/en/blog/vulnerability/example-release',
        publishedAt: '2025-05-14T00:00:00Z',
        summary:
          'Node.js publie des correctifs de securite pour les versions supportees.',
        categories: ['Node.js', 'security'],
      },
    ]);
    assert.strictEqual(JSON.stringify(entries).includes('Full body'), false);
  });
});

describe('mapRssAtomEntriesToIngestionItems', () => {
  it('maps parsed RSS metadata to ingestion items without body fields', () => {
    const parsedEntries = parseRssAtomFeedEntries(rssFeed);

    const result = mapRssAtomEntriesToIngestionItems(
      rssAtomSource,
      parsedEntries,
    );

    assert.deepEqual(result.items, [
      {
        title: 'React Compiler release candidate',
        sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
        source: {
          name: 'React Blog',
          url: 'https://react.dev/blog',
          type: RSS_ATOM_SOURCE_TYPE,
        },
        candidateCategory: 'release',
        candidateTechnologies: ['React'],
        publishedAt: 'Mon, 21 Apr 2025 00:00:00 GMT',
        shortSummary: 'Le compilateur React progresse vers une adoption stable.',
      },
    ]);
    assert.deepEqual(result.entries, [
      {
        title: 'React Compiler release candidate',
        sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
        status: 'mapped',
        warnings: [],
        errors: [],
      },
    ]);
    assert.strictEqual(JSON.stringify(result.items).includes('Full body'), false);
  });

  it('rejects entries without a title before ingestion validation', () => {
    const result = mapRssAtomEntriesToIngestionItems(rssAtomSource, [
      {
        title: null,
        sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
        publishedAt: null,
        summary: null,
        categories: ['release'],
      },
    ]);

    assert.deepEqual(result.items, []);
    assert.deepEqual(result.entries[0]?.errors, [
      { code: 'entry.titleMissing', field: 'title' },
    ]);
  });

  it('rejects entries without a public HTTP source URL', () => {
    const entries: RssAtomParsedFeedEntry[] = [
      {
        title: 'Missing URL',
        sourceUrl: null,
        publishedAt: null,
        summary: null,
        categories: ['release'],
      },
      {
        title: 'Invalid URL',
        sourceUrl: 'javascript:alert(1)',
        publishedAt: null,
        summary: null,
        categories: ['release'],
      },
    ];

    const result = mapRssAtomEntriesToIngestionItems(rssAtomSource, entries);

    assert.deepEqual(result.items, []);
    assert.deepEqual(
      result.entries.map((entry) => entry.errors),
      [
        [{ code: 'entry.sourceUrlMissing', field: 'sourceUrl' }],
        [{ code: 'entry.sourceUrlInvalid', field: 'sourceUrl' }],
      ],
    );
  });

  it('rejects entries with summaries that are too long to stay short', () => {
    const result = mapRssAtomEntriesToIngestionItems(rssAtomSource, [
      {
        title: 'Long summary',
        sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
        publishedAt: null,
        summary: 'a'.repeat(501),
        categories: ['release'],
      },
    ]);

    assert.deepEqual(result.items, []);
    assert.deepEqual(result.entries[0]?.errors, [
      { code: 'entry.summaryTooLong', field: 'summary' },
    ]);
  });

  it('infers the source default technology when entries do not expose tags', () => {
    const result = mapRssAtomEntriesToIngestionItems(rssAtomSource, [
      {
        title: 'Metadata-only entry',
        sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
        publishedAt: null,
        summary: null,
        categories: [],
      },
    ]);

    assert.strictEqual(result.items.length, 1);
    assert.deepEqual(result.items[0]?.candidateCategory, null);
    assert.deepEqual(result.items[0]?.candidateTechnologies, ['React']);
    assert.deepEqual(result.entries[0]?.warnings, [
      { code: 'entry.categoryMissing', field: 'categories' },
    ]);
  });

  it('infers security categories from strong title signals', () => {
    const result = mapRssAtomEntriesToIngestionItems(rssAtomSource, [
      {
        title: 'Critical Security Vulnerability in React Server Components',
        sourceUrl: 'https://react.dev/blog/security-vulnerability',
        publishedAt: null,
        summary: null,
        categories: [],
      },
    ]);

    assert.strictEqual(result.items.length, 1);
    assert.deepEqual(result.items[0]?.candidateCategory, 'security');
    assert.deepEqual(result.items[0]?.candidateTechnologies, ['React']);
    assert.deepEqual(result.entries[0]?.warnings, []);
  });

  it('keeps a category warning when title signals are not strong enough', () => {
    const result = mapRssAtomEntriesToIngestionItems(rssAtomSource, [
      {
        title: 'React Conf 2025 Recap',
        sourceUrl: 'https://react.dev/blog/react-conf-2025-recap',
        publishedAt: null,
        summary: null,
        categories: [],
      },
    ]);

    assert.strictEqual(result.items.length, 1);
    assert.deepEqual(result.items[0]?.candidateCategory, null);
    assert.deepEqual(result.items[0]?.candidateTechnologies, ['React']);
    assert.deepEqual(result.entries[0]?.warnings, [
      { code: 'entry.categoryMissing', field: 'categories' },
    ]);
  });

  it('keeps a technology warning when neither entry tags nor source default exist', () => {
    const { defaultTechnology: _defaultTechnology, ...sourceWithoutDefault } =
      rssAtomSource;

    const result = mapRssAtomEntriesToIngestionItems(
      sourceWithoutDefault,
      [
        {
          title: 'Metadata-only entry',
          sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
          publishedAt: null,
          summary: null,
          categories: [],
        },
      ],
    );

    assert.strictEqual(result.items.length, 1);
    assert.deepEqual(result.items[0]?.candidateTechnologies, []);
    assert.deepEqual(result.entries[0]?.warnings, [
      { code: 'entry.categoryMissing', field: 'categories' },
      { code: 'entry.technologyMissing', field: 'categories' },
    ]);
  });
});

describe('runRssAtomIngestionAdapter', () => {
  it('fetches, parses and maps an active RSS Atom source through injected fetch', async () => {
    const fetchFeed = vi.fn(async () => rssFeed);

    const result = await runRssAtomIngestionAdapter(rssAtomSource, {
      fetchFeed,
    });

    assert.strictEqual(fetchFeed.mock.calls.length, 1);
    assert.deepEqual(fetchFeed.mock.calls[0], ['https://react.dev/rss.xml']);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0]?.title, 'React Compiler release candidate');
    assert.deepEqual(result.entries[0]?.errors, []);
  });

  it('does not fetch inactive sources', async () => {
    const fetchFeed = vi.fn(async () => rssFeed);

    const result = await runRssAtomIngestionAdapter(
      {
        ...rssAtomSource,
        status: 'inactive',
      },
      {
        fetchFeed,
      },
    );

    assert.strictEqual(fetchFeed.mock.calls.length, 0);
    assert.deepEqual(result.items, []);
    assert.deepEqual(result.entries[0]?.errors, [
      { code: 'source.inactive', field: 'source.status' },
    ]);
  });

  it('does not fetch unsupported source types', async () => {
    const fetchFeed = vi.fn(async () => rssFeed);

    const result = await runRssAtomIngestionAdapter(
      {
        ...rssAtomSource,
        type: 'public_metadata',
      },
      {
        fetchFeed,
      },
    );

    assert.strictEqual(fetchFeed.mock.calls.length, 0);
    assert.deepEqual(result.items, []);
    assert.deepEqual(result.entries[0]?.errors, [
      { code: 'source.typeUnsupported', field: 'source.type' },
    ]);
  });

  it('reports fetch failures without leaking provider error details', async () => {
    const fetchFeed = vi.fn(async () => {
      throw new Error('provider secret timeout payload');
    });

    const result = await runRssAtomIngestionAdapter(rssAtomSource, {
      fetchFeed,
    });

    assert.deepEqual(result.items, []);
    assert.deepEqual(result.entries[0]?.errors, [
      { code: 'feed.fetchFailed', field: 'fetchFeed' },
    ]);
    assert.strictEqual(JSON.stringify(result).includes('provider secret'), false);
  });
});

describe('runRssAtomIngestion', () => {
  it('passes RSS Atom adapter items through validation, normalization and persistence', async () => {
    const fetchFeed = vi.fn(async () => rssFeed);
    const persistence = createPersistencePort();

    const result = await runRssAtomIngestion(rssAtomSource, {
      fetchFeed,
      normalizationContext,
      persistence,
    });

    assert.strictEqual(fetchFeed.mock.calls.length, 1);
    assert.strictEqual(persistence.upsertResourceDraft.mock.calls.length, 1);
    assert.deepEqual(result.adapter.items[0]?.title, 'React Compiler release candidate');
    assert.deepEqual(result.ingestion, {
      processedCount: 1,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      items: [
        {
          title: 'React Compiler release candidate',
          sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
          status: 'created',
          canonicalUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
          resourceId: 'resource-react-compiler',
          warnings: [],
          errors: [],
        },
      ],
    });
  });

  it('does not call persistence when the adapter rejects the source before fetch', async () => {
    const fetchFeed = vi.fn(async () => rssFeed);
    const persistence = createPersistencePort();

    const result = await runRssAtomIngestion(
      {
        ...rssAtomSource,
        status: 'inactive',
      },
      {
        fetchFeed,
        normalizationContext,
        persistence,
      },
    );

    assert.strictEqual(fetchFeed.mock.calls.length, 0);
    assert.strictEqual(persistence.upsertResourceDraft.mock.calls.length, 0);
    assert.deepEqual(result.adapter.entries[0]?.errors, [
      { code: 'source.inactive', field: 'source.status' },
    ]);
    assert.deepEqual(result.ingestion, {
      processedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      items: [],
    });
  });
});
