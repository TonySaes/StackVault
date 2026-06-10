import { assert, describe, it } from 'vitest';

import { parsePublicMetadataPage } from './public-metadata-ingestion-adapter.js';

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
