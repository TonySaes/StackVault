import { assert, describe, it } from 'vitest';

import { PrismaService } from '../../database/prisma.service.js';
import { CoverageService } from './coverage.service.js';

interface PrismaFindManyArgs {
  orderBy: unknown;
  select: Record<string, boolean>;
}

const publicCoverageSourceSelect = {
  id: true,
  name: true,
  url: true,
  type: true,
  status: true,
};

function createPrismaMock(technologies: unknown[], sources: unknown[]) {
  const technologyCalls: PrismaFindManyArgs[] = [];
  const sourceCalls: PrismaFindManyArgs[] = [];

  const prisma = {
    technology: {
      findMany(args: PrismaFindManyArgs) {
        technologyCalls.push(args);
        return Promise.resolve(technologies);
      },
    },
    source: {
      findMany(args: PrismaFindManyArgs) {
        sourceCalls.push(args);
        return Promise.resolve(sources);
      },
    },
    $transaction(operations: Promise<unknown>[]) {
      return Promise.all(operations);
    },
  } as unknown as PrismaService;

  return {
    prisma,
    technologyCalls,
    sourceCalls,
  };
}

describe('CoverageService', () => {
  it('returns empty coverage when no sources or technologies exist', async () => {
    const { prisma } = createPrismaMock([], []);
    const service = new CoverageService(prisma);

    const result = await service.getPublicCoverage();

    assert.deepEqual(result, {
      technologies: [],
      sources: [],
    });
  });

  it('maps public technologies and sources without admin-only fields', async () => {
    const technology = {
      id: 'technology-id',
      name: 'Node.js',
      slug: 'nodejs',
      status: 'active',
    };
    const source = {
      id: 'source-id',
      name: 'Node.js Blog',
      url: 'https://nodejs.org/en/blog',
      type: 'public_metadata',
      status: 'to_verify',
    };
    const { prisma, technologyCalls, sourceCalls } = createPrismaMock(
      [technology],
      [source],
    );
    const service = new CoverageService(prisma);

    const result = await service.getPublicCoverage();

    assert.deepEqual(technologyCalls[0]?.orderBy, { name: 'asc' });
    assert.deepEqual(sourceCalls[0]?.orderBy, { name: 'asc' });
    assert.deepEqual(sourceCalls[0]?.select, publicCoverageSourceSelect);
    assert.deepEqual(result, {
      technologies: [technology],
      sources: [source],
    });
    assert.strictEqual(result.sources[0]?.status, 'to_verify');
    assert.strictEqual('createdAt' in result.technologies[0]!, false);
    assert.strictEqual('updatedAt' in result.technologies[0]!, false);
    assert.strictEqual('lastIngestionAt' in result.sources[0]!, false);
    assert.strictEqual('lastCheckedAt' in result.sources[0]!, false);
    assert.strictEqual('createdAt' in result.sources[0]!, false);
    assert.strictEqual('updatedAt' in result.sources[0]!, false);
  });
});
