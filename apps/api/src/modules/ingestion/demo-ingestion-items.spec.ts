import { assert, describe, it } from 'vitest';

import { demoIngestionItems } from './demo-ingestion-items.js';
import { validateIngestionItem } from './ingestion-item.js';

describe('demoIngestionItems', () => {
  it('contains valid controlled demo items for security, release and trend', () => {
    const categories = new Set(
      demoIngestionItems.map((item) => item.candidateCategory),
    );

    assert.deepEqual(categories, new Set(['release', 'security', 'trend']));

    for (const item of demoIngestionItems) {
      const result = validateIngestionItem(item);

      assert.strictEqual(result.success, true);
    }
  });
});
