import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type { LinkCheckStatus } from './link-check-result.js';
import type {
  LinkCheckResource,
  LinkCheckResourceRepository,
} from './link-checks.service.js';

@Injectable()
export class PrismaLinkCheckResourceRepository
  implements LinkCheckResourceRepository
{
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  // Eligible resource selection
  // The job only needs IDs and source URLs. Ordering unchecked links first keeps
  // a bounded local run useful without introducing a run-history table yet.
  async findResourcesForLinkCheck(args: {
    limit: number;
  }): Promise<LinkCheckResource[]> {
    return this.prisma.resource.findMany({
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
      take: args.limit,
      select: {
        id: true,
        sourceUrl: true,
      },
    });
  }

  // Status persistence
  // Only link-check fields are updated here. Lifecycle and retention decisions
  // stay out of Story 2.11 so a dead link never deletes or hides a resource.
  async updateResourceLinkStatus(args: {
    resourceId: string;
    linkStatus: LinkCheckStatus;
    checkedAt: Date;
  }): Promise<void> {
    await this.prisma.resource.update({
      where: {
        id: args.resourceId,
      },
      data: {
        linkStatus: args.linkStatus,
        lastLinkCheckAt: args.checkedAt,
      },
    });
  }
}
