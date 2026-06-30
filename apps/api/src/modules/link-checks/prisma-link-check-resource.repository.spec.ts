import { assert, describe, it } from 'vitest';

import { PrismaService } from '../../database/prisma.service.js';
import { PrismaLinkCheckResourceRepository } from './prisma-link-check-resource.repository.js';

interface PrismaResourceFindManyArgs {
  where: unknown;
  orderBy: unknown;
  take: number;
  select: unknown;
}

interface PrismaResourceUpdateArgs {
  where: unknown;
  data: Record<string, unknown>;
}

function createPrismaMock(resources: unknown[] = []) {
  const findManyCalls: PrismaResourceFindManyArgs[] = [];
  const updateCalls: PrismaResourceUpdateArgs[] = [];

  const prisma = {
    resource: {
      findMany(args: PrismaResourceFindManyArgs) {
        findManyCalls.push(args);

        return Promise.resolve(resources);
      },
      update(args: PrismaResourceUpdateArgs) {
        updateCalls.push(args);

        return Promise.resolve(undefined);
      },
    },
  } as unknown as PrismaService;

  return {
    prisma,
    findManyCalls,
    updateCalls,
  };
}

describe('PrismaLinkCheckResourceRepository', () => {
  it('selects active resources eligible for link checks with an explicit limit', async () => {
    const resources = [
      {
        id: 'resource-id',
        sourceUrl: 'https://example.com/resource',
      },
    ];
    const { prisma, findManyCalls } = createPrismaMock(resources);
    const repository = new PrismaLinkCheckResourceRepository(prisma);

    const result = await repository.findResourcesForLinkCheck({ limit: 10 });

    assert.deepEqual(result, resources);
    assert.deepEqual(findManyCalls, [
      {
        where: {
          lifecycleStatus: 'active',
          sourceUrl: {
            not: '',
          },
        },
        orderBy: [
          {
            lastLinkCheckAt: {
              sort: 'asc',
              nulls: 'first',
            },
          },
          {
            detectedAt: 'desc',
          },
        ],
        take: 10,
        select: {
          id: true,
          sourceUrl: true,
        },
      },
    ]);
  });

  it('updates only link status and last check date for a resource', async () => {
    const checkedAt = new Date('2026-07-01T00:40:00.000Z');
    const { prisma, updateCalls } = createPrismaMock();
    const repository = new PrismaLinkCheckResourceRepository(prisma);

    await repository.updateResourceLinkStatus({
      resourceId: 'resource-id',
      linkStatus: 'unavailable',
      checkedAt,
    });

    assert.deepEqual(updateCalls, [
      {
        where: {
          id: 'resource-id',
        },
        data: {
          linkStatus: 'unavailable',
          lastLinkCheckAt: checkedAt,
        },
      },
    ]);
    assert.strictEqual('lifecycleStatus' in updateCalls[0]!.data, false);
    assert.strictEqual('deletedAt' in updateCalls[0]!.data, false);
  });
});
