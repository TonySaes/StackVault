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
});
