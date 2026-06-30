import { assert, describe, it } from 'vitest';

import {
  DEFAULT_LINK_CHECK_RUN_LIMIT,
  formatLinkCheckRunSummary,
  parseLinkCheckRunOptions,
  shouldPrintLinkCheckUsage,
} from './run-link-check-options.js';

describe('parseLinkCheckRunOptions', () => {
  it('uses the default limit when no argument is provided', () => {
    assert.deepEqual(parseLinkCheckRunOptions([]), {
      limit: DEFAULT_LINK_CHECK_RUN_LIMIT,
    });
  });

  it('parses explicit link check limits', () => {
    assert.deepEqual(parseLinkCheckRunOptions(['--limit', '5']), {
      limit: 5,
    });
    assert.deepEqual(parseLinkCheckRunOptions(['--limit=12']), {
      limit: 12,
    });
  });

  it('rejects invalid limits before the runner touches external services', () => {
    assert.throws(
      () => parseLinkCheckRunOptions(['--limit', '0']),
      /link_check.limit_invalid/,
    );
    assert.throws(
      () => parseLinkCheckRunOptions(['--limit', 'not-a-number']),
      /link_check.limit_invalid/,
    );
  });
});

describe('shouldPrintLinkCheckUsage', () => {
  it('detects help flags without running the job', () => {
    assert.strictEqual(shouldPrintLinkCheckUsage(['--help']), true);
    assert.strictEqual(shouldPrintLinkCheckUsage(['-h']), true);
    assert.strictEqual(shouldPrintLinkCheckUsage(['--limit', '5']), false);
  });
});

describe('formatLinkCheckRunSummary', () => {
  it('formats a non-sensitive local run summary', () => {
    assert.strictEqual(
      formatLinkCheckRunSummary({
        checkedResourceCount: 3,
        updatedResourceCount: 2,
        failedResourceCount: 1,
      }),
      'Verification des liens terminee: 3 verifies, 2 mis a jour, 1 echec.',
    );
  });
});
