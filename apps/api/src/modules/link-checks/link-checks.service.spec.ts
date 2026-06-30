import { assert, describe, it } from 'vitest';

import { LinkChecksService } from './link-checks.service.js';

describe('LinkChecksService', () => {
  it('exposes the link check classification through an injectable service', () => {
    const service = new LinkChecksService();

    assert.strictEqual(
      service.classifyResult({ kind: 'http_response', statusCode: 301 }),
      'redirect',
    );
  });
});
