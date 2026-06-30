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

  it('checks eligible resources and persists their link status', async () => {
    const checkedAt = new Date('2026-07-01T00:30:00.000Z');
    const updates: unknown[] = [];
    const service = new LinkChecksService();

    const result = await service.runLinkCheckJob({
      checkedAt,
      limit: 10,
      repository: {
        findResourcesForLinkCheck(args) {
          assert.deepEqual(args, { limit: 10 });

          return Promise.resolve([
            {
              id: 'active-resource',
              sourceUrl: 'https://example.com/active',
            },
            {
              id: 'redirect-resource',
              sourceUrl: 'https://example.com/redirect',
            },
          ]);
        },
        updateResourceLinkStatus(args) {
          updates.push(args);

          return Promise.resolve();
        },
      },
      checker: {
        checkLink(sourceUrl) {
          if (sourceUrl.endsWith('/redirect')) {
            return Promise.resolve({
              kind: 'http_response',
              statusCode: 301,
            });
          }

          return Promise.resolve({
            kind: 'http_response',
            statusCode: 200,
          });
        },
      },
    });

    assert.deepEqual(updates, [
      {
        resourceId: 'active-resource',
        linkStatus: 'active',
        checkedAt,
      },
      {
        resourceId: 'redirect-resource',
        linkStatus: 'redirect',
        checkedAt,
      },
    ]);
    assert.deepEqual(result, {
      checkedResourceCount: 2,
      updatedResourceCount: 2,
      failedResourceCount: 0,
      resources: [
        {
          resourceId: 'active-resource',
          sourceUrl: 'https://example.com/active',
          status: 'updated',
          linkStatus: 'active',
        },
        {
          resourceId: 'redirect-resource',
          sourceUrl: 'https://example.com/redirect',
          status: 'updated',
          linkStatus: 'redirect',
        },
      ],
    });
  });

  it('marks unexpected checker failures as unavailable and continues the batch', async () => {
    const checkedAt = new Date('2026-07-01T00:35:00.000Z');
    const updates: unknown[] = [];
    const checkedUrls: string[] = [];
    const service = new LinkChecksService();

    const result = await service.runLinkCheckJob({
      checkedAt,
      repository: {
        findResourcesForLinkCheck() {
          return Promise.resolve([
            {
              id: 'failing-resource',
              sourceUrl: 'https://example.com/failing',
            },
            {
              id: 'next-resource',
              sourceUrl: 'https://example.com/next',
            },
          ]);
        },
        updateResourceLinkStatus(args) {
          updates.push(args);

          return Promise.resolve();
        },
      },
      checker: {
        checkLink(sourceUrl) {
          checkedUrls.push(sourceUrl);

          if (sourceUrl.endsWith('/failing')) {
            return Promise.reject(new Error('raw provider failure'));
          }

          return Promise.resolve({
            kind: 'http_response',
            statusCode: 204,
          });
        },
      },
    });

    assert.deepEqual(checkedUrls, [
      'https://example.com/failing',
      'https://example.com/next',
    ]);
    assert.deepEqual(updates, [
      {
        resourceId: 'failing-resource',
        linkStatus: 'unavailable',
        checkedAt,
      },
      {
        resourceId: 'next-resource',
        linkStatus: 'active',
        checkedAt,
      },
    ]);
    assert.deepEqual(result.resources, [
      {
        resourceId: 'failing-resource',
        sourceUrl: 'https://example.com/failing',
        status: 'updated',
        linkStatus: 'unavailable',
        issueCode: 'link_check_failed',
      },
      {
        resourceId: 'next-resource',
        sourceUrl: 'https://example.com/next',
        status: 'updated',
        linkStatus: 'active',
      },
    ]);
    assert.strictEqual(result.checkedResourceCount, 2);
    assert.strictEqual(result.updatedResourceCount, 2);
    assert.strictEqual(result.failedResourceCount, 0);
  });
});
