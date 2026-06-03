import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PrismaService } from '../../database/prisma.service.js';
import { ResourcesService } from './resources.service.js';

interface PrismaResourceFindManyArgs {
  orderBy: unknown;
  skip: number;
  take: number;
}

function createPrismaMock(resources: unknown[], total: number) {
  const calls: PrismaResourceFindManyArgs[] = [];

  const prisma = {
    resource: {
      findMany(args: PrismaResourceFindManyArgs) {
        calls.push(args);
        return Promise.resolve(resources);
      },
      count() {
        return Promise.resolve(total);
      },
    },
    $transaction(operations: Promise<unknown>[]) {
      return Promise.all(operations);
    },
  } as unknown as PrismaService;

  return {
    prisma,
    calls,
  };
}

describe('ResourcesService', () => {
  it('returns an empty paginated response when no public resources exist', async () => {
    const { prisma } = createPrismaMock([], 0);
    const service = new ResourcesService(prisma);

    const result = await service.listResources({
      page: 1,
      pageSize: 20,
    });

    assert.deepEqual(result, {
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
  });

  it('clamps pageSize and maps resource technology links to public technologies', async () => {
    const resource = {
      id: 'resource-id',
      title: 'Node.js security releases',
      shortSummary: 'Security release guidance.',
      sourceUrl: 'https://nodejs.org/en/blog/vulnerability',
      canonicalUrl: 'https://nodejs.org/en/blog/vulnerability',
      publishedAt: new Date('2025-05-14T00:00:00.000Z'),
      detectedAt: new Date('2026-05-20T16:04:52.047Z'),
      lifecycleStatus: 'active',
      linkStatus: 'unknown',
      source: {
        id: 'source-id',
        name: 'Node.js Blog',
        url: 'https://nodejs.org/en/blog',
        type: 'public_metadata',
        status: 'active',
      },
      category: {
        id: 'category-id',
        name: 'Security',
        slug: 'security',
        signalType: 'security',
      },
      technologyLinks: [
        {
          technology: {
            id: 'technology-id',
            name: 'Node.js',
            slug: 'nodejs',
            status: 'active',
          },
        },
      ],
    };
    const { prisma, calls } = createPrismaMock([resource], 1);
    const service = new ResourcesService(prisma);

    const result = await service.listResources({
      page: '1',
      pageSize: '999',
    } as never);

    assert.equal(calls[0]?.skip, 0);
    assert.equal(calls[0]?.take, 50);
    assert.deepEqual(calls[0]?.orderBy, [
      { publishedAt: { sort: 'desc', nulls: 'last' } },
      { detectedAt: 'desc' },
    ]);
    assert.equal(result.pageSize, 50);
    assert.equal(result.total, 1);
    assert.deepEqual(result.items[0]?.technologies, [
      {
        id: 'technology-id',
        name: 'Node.js',
        slug: 'nodejs',
        status: 'active',
      },
    ]);
    assert.equal('technologyLinks' in result.items[0]!, false);
    assert.equal('body' in result.items[0]!, false);
    assert.equal('fullText' in result.items[0]!, false);
    assert.equal('rawContent' in result.items[0]!, false);
  });
});
