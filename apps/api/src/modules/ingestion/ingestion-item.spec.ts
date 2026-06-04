import { assert, describe, it } from 'vitest';

import { validateIngestionItem } from './ingestion-item.js';

const validIngestionItem = {
  title: 'React Compiler release candidate',
  sourceUrl: 'https://react.dev/blog/2025/04/21/react-compiler-rc',
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

describe('validateIngestionItem', () => {
  it('accepts a valid ingestion item with candidate metadata', () => {
    const result = validateIngestionItem(validIngestionItem);

    assert.strictEqual(result.success, true);

    if (result.success) {
      assert.deepEqual(result.item, validIngestionItem);
    }
  });

  it('rejects missing required title and source URL fields', () => {
    const result = validateIngestionItem({
      ...validIngestionItem,
      title: '',
      sourceUrl: '',
    });

    assert.strictEqual(result.success, false);

    if (!result.success) {
      assert.deepEqual(
        result.errors.map((error) => error.code),
        ['title.required', 'sourceUrl.required'],
      );
    }
  });

  it('rejects an invalid source URL before public resource creation', () => {
    const result = validateIngestionItem({
      ...validIngestionItem,
      sourceUrl: 'not a valid url',
    });

    assert.strictEqual(result.success, false);

    if (!result.success) {
      assert.deepEqual(result.errors, [
        {
          code: 'sourceUrl.invalid',
          field: 'sourceUrl',
        },
      ]);
    }
  });

  it('rejects complete third-party body fields', () => {
    const result = validateIngestionItem({
      ...validIngestionItem,
      rawContent: '<article>Full third-party article</article>',
    });

    assert.strictEqual(result.success, false);

    if (!result.success) {
      assert.deepEqual(result.errors, [
        {
          code: 'thirdPartyBody.forbidden',
          field: 'rawContent',
        },
      ]);
    }
  });

  it('returns non-sensitive validation errors without source payload values', () => {
    const result = validateIngestionItem({
      ...validIngestionItem,
      body: 'Sensitive full source body',
    });

    assert.strictEqual(result.success, false);

    if (!result.success) {
      assert.strictEqual(JSON.stringify(result.errors).includes('Sensitive'), false);
    }
  });
});
