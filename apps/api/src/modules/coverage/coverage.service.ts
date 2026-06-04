import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';

interface PublicCoverageTechnology {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface PublicCoverageSource {
  id: string;
  name: string;
  url: string;
  type: string;
  status: string;
}

export interface PublicCoverageResponse {
  technologies: PublicCoverageTechnology[];
  sources: PublicCoverageSource[];
}

// Public coverage contract
// Coverage exposes the source allowlist perimeter, but not ingestion/admin
// timestamps. Those diagnostics belong to future admin views.
const publicCoverageSourceSelect = {
  id: true,
  name: true,
  url: true,
  type: true,
  status: true,
} as const;

@Injectable()
export class CoverageService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async getPublicCoverage(): Promise<PublicCoverageResponse> {
    const [technologies, sources] = await this.prisma.$transaction([
      this.prisma.technology.findMany({
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
      }),
      this.prisma.source.findMany({
        orderBy: {
          name: 'asc',
        },
        select: publicCoverageSourceSelect,
      }),
    ]);

    return {
      technologies,
      sources,
    };
  }
}
