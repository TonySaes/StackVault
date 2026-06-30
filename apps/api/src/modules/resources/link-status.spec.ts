import { assert, describe, it } from 'vitest';

import {
  PUBLIC_RESOURCE_LINK_STATUSES,
  normalizePublicLinkStatus,
} from './link-status.js';

describe('normalizePublicLinkStatus', () => {
  it('keeps every public link status supported by the API contract', () => {
    for (const linkStatus of PUBLIC_RESOURCE_LINK_STATUSES) {
      assert.strictEqual(normalizePublicLinkStatus(linkStatus), linkStatus);
    }
  });

  it('falls back to to_verify for unsupported database values', () => {
    assert.strictEqual(
      normalizePublicLinkStatus('provider-specific-value'),
      'to_verify',
    );
  });
});
