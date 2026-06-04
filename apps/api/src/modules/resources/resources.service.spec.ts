import { assert, describe, expect, it } from 'vitest';

import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { ResourcesService } from './resources.service.js';

interface PrismaResourceFindManyArgs {
  orderBy: unknown;
  select: {
    source?: {
      select?: Record<string, boolean>;
    };
  };
  skip: number;
  take: number;
}

interface PrismaResourceFindFirstArgs {
  select: {
    source?: {
      select?: Record<string, boolean>;
    };
  };
  where: unknown;
}

const publicSourceSelect = {
  id: true,
  name: true,
  url: true,
  type: true,
  status: true,
};

const publicResourceRecord = {
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

const inactiveSourceResourceRecord = {
  ...publicResourceRecord,
  id: 'inactive-source-resource-id',
  source: {
    ...publicResourceRecord.source,
    id: 'inactive-source-id',
    name: 'Inactive Source',
    status: 'inactive',
  },
};

const sourceToVerifyResourceRecord = {
  ...publicResourceRecord,
  id: 'source-to-verify-resource-id',
  source: {
    ...publicResourceRecord.source,
    id: 'source-to-verify-id',
    name: 'Source To Verify',
    status: 'to_verify',
  },
};

function createPrismaMock(
  resources: unknown[],
  total: number,
  resourceDetail: unknown = null,
) {
  const calls: PrismaResourceFindManyArgs[] = [];
  const detailCalls: PrismaResourceFindFirstArgs[] = [];

  const prisma = {
    resource: {
      findMany(args: PrismaResourceFindManyArgs) {
        calls.push(args);
        return Promise.resolve(resources);
      },
      findFirst(args: PrismaResourceFindFirstArgs) {
        detailCalls.push(args);
        return Promise.resolve(resourceDetail);
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
    detailCalls,
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
    const { prisma, calls } = createPrismaMock([publicResourceRecord], 1);
    const service = new ResourcesService(prisma);

    const result = await service.listResources({
      page: '1',
      pageSize: '999',
    } as never);

    assert.strictEqual(calls[0]?.skip, 0);
    assert.strictEqual(calls[0]?.take, 50);
    assert.deepEqual(calls[0]?.orderBy, [
      { publishedAt: { sort: 'desc', nulls: 'last' } },
      { detectedAt: 'desc' },
    ]);
    assert.strictEqual(result.pageSize, 50);
    assert.strictEqual(result.total, 1);
    assert.deepEqual(calls[0]?.select.source?.select, publicSourceSelect);
    assert.deepEqual(result.items[0]?.technologies, [
      {
        id: 'technology-id',
        name: 'Node.js',
        slug: 'nodejs',
        status: 'active',
      },
    ]);
    assert.strictEqual('technologyLinks' in result.items[0]!, false);
    assert.strictEqual('body' in result.items[0]!, false);
    assert.strictEqual('fullText' in result.items[0]!, false);
    assert.strictEqual('rawContent' in result.items[0]!, false);
    assert.deepEqual(result.items[0]?.source, {
      id: 'source-id',
      name: 'Node.js Blog',
      url: 'https://nodejs.org/en/blog',
      type: 'public_metadata',
      status: 'active',
    });
    assert.strictEqual('lastIngestionAt' in result.items[0]!.source, false);
    assert.strictEqual('lastCheckedAt' in result.items[0]!.source, false);
    assert.strictEqual('createdAt' in result.items[0]!.source, false);
    assert.strictEqual('updatedAt' in result.items[0]!.source, false);
  });

  it('preserves an inactive source status in the public list contract', async () => {
    const { prisma } = createPrismaMock([inactiveSourceResourceRecord], 1);
    const service = new ResourcesService(prisma);

    const result = await service.listResources({
      page: 1,
      pageSize: 20,
    });

    assert.strictEqual(result.items[0]?.source.name, 'Inactive Source');
    assert.strictEqual(result.items[0]?.source.status, 'inactive');
  });

  it('preserves a source to verify status in the public list contract', async () => {
    const { prisma } = createPrismaMock([sourceToVerifyResourceRecord], 1);
    const service = new ResourcesService(prisma);

    const result = await service.listResources({
      page: 1,
      pageSize: 20,
    });

    assert.strictEqual(result.items[0]?.source.name, 'Source To Verify');
    assert.strictEqual(result.items[0]?.source.status, 'to_verify');
  });

  it('returns one active public resource by id', async () => {
    const { prisma, detailCalls } = createPrismaMock(
      [],
      0,
      publicResourceRecord,
    );
    const service = new ResourcesService(prisma);

    const result = await service.getResourceById('resource-id');

    assert.deepEqual(detailCalls[0]?.where, {
      id: 'resource-id',
      lifecycleStatus: 'active',
    });
    assert.deepEqual(detailCalls[0]?.select.source?.select, publicSourceSelect);
    assert.strictEqual(result.id, 'resource-id');
    assert.deepEqual(result.technologies, [
      {
        id: 'technology-id',
        name: 'Node.js',
        slug: 'nodejs',
        status: 'active',
      },
    ]);
    assert.strictEqual('technologyLinks' in result, false);
  });

  it('throws a not found exception when the public resource does not exist', async () => {
    const { prisma } = createPrismaMock([], 0, null);
    const service = new ResourcesService(prisma);

    await expect(
      service.getResourceById('missing-resource-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
