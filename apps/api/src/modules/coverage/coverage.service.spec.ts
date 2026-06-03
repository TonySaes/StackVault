import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PrismaService } from '../../database/prisma.service.js';
import { CoverageService } from './coverage.service.js';

interface PrismaFindManyArgs {
  orderBy: unknown;
  select: unknown;
}

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
      status: 'active',
    };
    const { prisma, technologyCalls, sourceCalls } = createPrismaMock(
      [technology],
      [source],
    );
    const service = new CoverageService(prisma);

    const result = await service.getPublicCoverage();

    assert.deepEqual(technologyCalls[0]?.orderBy, { name: 'asc' });
    assert.deepEqual(sourceCalls[0]?.orderBy, { name: 'asc' });
    assert.deepEqual(result, {
      technologies: [technology],
      sources: [source],
    });
    assert.equal('createdAt' in result.technologies[0]!, false);
    assert.equal('updatedAt' in result.technologies[0]!, false);
    assert.equal('lastIngestionAt' in result.sources[0]!, false);
    assert.equal('lastCheckedAt' in result.sources[0]!, false);
  });
});
