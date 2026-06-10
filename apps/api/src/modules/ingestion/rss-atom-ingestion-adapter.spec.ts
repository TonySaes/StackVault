import { assert, describe, it } from 'vitest';

import {
  mapRssAtomEntriesToIngestionItems,
  parseRssAtomFeedEntries,
  RSS_ATOM_SOURCE_TYPE,
  type RssAtomIngestionSource,
  type RssAtomParsedFeedEntry,
} from './rss-atom-ingestion-adapter.js';

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
  status: 'active',
  type: RSS_ATOM_SOURCE_TYPE,
};

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

  it('keeps usable entries with non-blocking classification warnings', () => {
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
    assert.deepEqual(result.items[0]?.candidateTechnologies, []);
    assert.deepEqual(result.entries[0]?.warnings, [
      { code: 'entry.categoryMissing', field: 'categories' },
      { code: 'entry.technologyMissing', field: 'categories' },
    ]);
  });
});
