import { assert, describe, it } from 'vitest';

import type { IngestionItem } from './ingestion-item.js';
import {
  normalizeIngestionItem,
  type IngestionNormalizationContext,
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
  shortSummary: 'React Compiler reaches release candidate status.',
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

describe('normalizeIngestionItem', () => {
  it('normalizes a valid ingestion item into a public resource draft', () => {
    const result = normalizeIngestionItem(
      validIngestionItem,
      normalizationContext,
    );

    assert.strictEqual(result.success, true);

    if (result.success) {
      assert.deepEqual(result.draft, {
        sourceId: 'source-react-blog',
        categoryId: 'category-release',
        title: 'React Compiler release candidate',
        sourceUrl:
          'https://react.dev/blog/2025/04/21/react-compiler-rc/?utm_source=newsletter#details',
        canonicalUrl:
          'https://react.dev/blog/2025/04/21/react-compiler-rc',
        publishedAt: new Date('2025-04-21T00:00:00.000Z'),
        shortSummary: 'React Compiler reaches release candidate status.',
        lifecycleStatus: 'active',
        linkStatus: 'unknown',
        technologyIds: ['technology-react'],
      });
      assert.deepEqual(result.warnings, []);
    }
  });

  it('keeps the link status unknown until a dedicated link check job verifies it', () => {
    const result = normalizeIngestionItem(
      validIngestionItem,
      normalizationContext,
    );

    assert.strictEqual(result.success, true);

    if (result.success) {
      assert.strictEqual(result.draft.linkStatus, 'unknown');
    }
  });

  it('uses the explicit fallback category when the candidate category is unknown', () => {
    const result = normalizeIngestionItem(
      {
        ...validIngestionItem,
        candidateCategory: 'unknown-signal',
      },
      normalizationContext,
    );

    assert.strictEqual(result.success, true);

    if (result.success) {
      assert.strictEqual(result.draft.categoryId, 'category-trend');
      assert.deepEqual(result.warnings, [
        {
          code: 'category.fallback',
          field: 'candidateCategory',
        },
      ]);
    }
  });

  it('matches candidate categories without trusting casing or surrounding spaces', () => {
    const result = normalizeIngestionItem(
      {
        ...validIngestionItem,
        candidateCategory: ' Release ',
      },
      normalizationContext,
    );

    assert.strictEqual(result.success, true);

    if (result.success) {
      assert.strictEqual(result.draft.categoryId, 'category-release');
      assert.deepEqual(result.warnings, []);
    }
  });

  it('does not report a fallback warning when the candidate category matches the fallback category', () => {
    const result = normalizeIngestionItem(
      {
        ...validIngestionItem,
        candidateCategory: 'trend',
      },
      normalizationContext,
    );

    assert.strictEqual(result.success, true);

    if (result.success) {
      assert.strictEqual(result.draft.categoryId, 'category-trend');
      assert.deepEqual(result.warnings, []);
    }
  });

  it('ignores unknown candidate technologies and reports a non-sensitive warning', () => {
    const result = normalizeIngestionItem(
      {
        ...validIngestionItem,
        candidateTechnologies: ['React', 'Unknown Framework'],
      },
      normalizationContext,
    );

    assert.strictEqual(result.success, true);

    if (result.success) {
      assert.deepEqual(result.draft.technologyIds, ['technology-react']);
      assert.deepEqual(result.warnings, [
        {
          code: 'technology.unmatched',
          field: 'candidateTechnologies',
        },
      ]);
    }
  });

  it('deduplicates technologies that resolve to the same id', () => {
    const result = normalizeIngestionItem(
      {
        ...validIngestionItem,
        candidateTechnologies: ['React', 'react'],
      },
      normalizationContext,
    );

    assert.strictEqual(result.success, true);

    if (result.success) {
      assert.deepEqual(result.draft.technologyIds, ['technology-react']);
      assert.deepEqual(result.warnings, []);
    }
  });

  it('matches allowlisted source URLs through canonical normalization', () => {
    const result = normalizeIngestionItem(
      {
        ...validIngestionItem,
        source: {
          ...validIngestionItem.source,
          url: 'https://react.dev/blog/',
        },
      },
      normalizationContext,
    );

    assert.strictEqual(result.success, true);

    if (result.success) {
      assert.strictEqual(result.draft.sourceId, 'source-react-blog');
    }
  });

  it('returns a non-sensitive error when the source is not allowlisted', () => {
    const result = normalizeIngestionItem(validIngestionItem, {
      ...normalizationContext,
      sources: [],
    });

    assert.strictEqual(result.success, false);

    if (!result.success) {
      assert.deepEqual(result.errors, [
        {
          code: 'source.notAllowlisted',
          field: 'source',
        },
      ]);
    }
  });

  it('returns a non-sensitive error when sourceUrl is outside the allowlisted source perimeter', () => {
    const result = normalizeIngestionItem(
      {
        ...validIngestionItem,
        sourceUrl: 'https://example.invalid/fake-react-compiler-post',
      },
      normalizationContext,
    );

    assert.strictEqual(result.success, false);

    if (!result.success) {
      assert.deepEqual(result.errors, [
        {
          code: 'sourceUrl.notAllowlisted',
          field: 'sourceUrl',
        },
      ]);
    }
  });

  it('allows sourceUrl paths under a root-level allowlisted source domain', () => {
    const result = normalizeIngestionItem(
      {
        ...validIngestionItem,
        source: {
          ...validIngestionItem.source,
          url: 'https://react.dev',
        },
      },
      {
      ...normalizationContext,
      sources: [
        {
          ...normalizationContext.sources[0]!,
          url: 'https://react.dev',
        },
      ],
      },
    );

    assert.strictEqual(result.success, true);
  });

  it('returns a non-sensitive error when publication date cannot be normalized', () => {
    const result = normalizeIngestionItem(
      {
        ...validIngestionItem,
        publishedAt: new Date('not-a-date'),
      },
      normalizationContext,
    );

    assert.strictEqual(result.success, false);

    if (!result.success) {
      assert.deepEqual(result.errors, [
        {
          code: 'publishedAt.invalid',
          field: 'publishedAt',
        },
      ]);
    }
  });

  it('returns a non-sensitive error when the allowlisted source is inactive', () => {
    const result = normalizeIngestionItem(validIngestionItem, {
      ...normalizationContext,
      sources: [
        {
          ...normalizationContext.sources[0]!,
          status: 'inactive',
        },
      ],
    });

    assert.strictEqual(result.success, false);

    if (!result.success) {
      assert.deepEqual(result.errors, [
        {
          code: 'source.inactive',
          field: 'source',
        },
      ]);
    }
  });

  it('does not carry complete third-party body fields into the public draft', () => {
    const itemWithRuntimeExtraFields = {
      ...validIngestionItem,
      rawContent: '<article>Full third-party article</article>',
      bodyHtml: '<article>Full HTML body</article>',
    } as IngestionItem & {
      rawContent: string;
      bodyHtml: string;
    };

    const result = normalizeIngestionItem(
      itemWithRuntimeExtraFields,
      normalizationContext,
    );

    assert.strictEqual(result.success, true);

    if (result.success) {
      assert.deepEqual(Object.keys(result.draft).sort(), [
        'canonicalUrl',
        'categoryId',
        'lifecycleStatus',
        'linkStatus',
        'publishedAt',
        'shortSummary',
        'sourceId',
        'sourceUrl',
        'technologyIds',
        'title',
      ]);
      assert.strictEqual('rawContent' in result.draft, false);
      assert.strictEqual('bodyHtml' in result.draft, false);
    }
  });
});
