import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import {
  ListResourcesQueryDto,
  normalizeListResourcesQuery,
} from './dto/list-resources-query.dto.js';

interface PublicResourceSource {
  id: string;
  name: string;
  url: string;
  type: string;
  status: string;
}

interface PublicResourceCategory {
  id: string;
  name: string;
  slug: string;
  signalType: string;
}

interface PublicResourceTechnology {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface PublicResourceItem {
  id: string;
  title: string;
  shortSummary: string | null;
  sourceUrl: string;
  canonicalUrl: string;
  publishedAt: Date | null;
  detectedAt: Date;
  lifecycleStatus: string;
  linkStatus: string;
  source: PublicResourceSource;
  category: PublicResourceCategory;
  technologies: PublicResourceTechnology[];
}

export interface PaginatedResourcesResponse {
  items: PublicResourceItem[];
  page: number;
  pageSize: number;
  total: number;
}

@Injectable()
export class ResourcesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async listResources(
    query: ListResourcesQueryDto,
  ): Promise<PaginatedResourcesResponse> {
    const { page, pageSize } = normalizeListResourcesQuery(query);
    const skip = (page - 1) * pageSize;

    const [resources, total] = await this.prisma.$transaction([
      this.prisma.resource.findMany({
        where: {
          lifecycleStatus: 'active',
        },
        orderBy: [
          { publishedAt: { sort: 'desc', nulls: 'last' } },
          { detectedAt: 'desc' },
        ],
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          shortSummary: true,
          sourceUrl: true,
          canonicalUrl: true,
          publishedAt: true,
          detectedAt: true,
          lifecycleStatus: true,
          linkStatus: true,
          source: {
            select: {
              id: true,
              name: true,
              url: true,
              type: true,
              status: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              signalType: true,
            },
          },
          technologyLinks: {
            select: {
              technology: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true,
                },
              },
            },
            orderBy: {
              technology: {
                name: 'asc',
              },
            },
          },
        },
      }),
      this.prisma.resource.count({
        where: {
          lifecycleStatus: 'active',
        },
      }),
    ]);

    return {
      items: resources.map((resource) => this.mapPublicResource(resource)),
      page,
      pageSize,
      total,
    };
  }

  async getResourceById(resourceId: string): Promise<PublicResourceItem> {
    const resource = await this.prisma.resource.findFirst({
      where: {
        id: resourceId,
        lifecycleStatus: 'active',
      },
      select: {
        id: true,
        title: true,
        shortSummary: true,
        sourceUrl: true,
        canonicalUrl: true,
        publishedAt: true,
        detectedAt: true,
        lifecycleStatus: true,
        linkStatus: true,
        source: {
          select: {
            id: true,
            name: true,
            url: true,
            type: true,
            status: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            signalType: true,
          },
        },
        technologyLinks: {
          select: {
            technology: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
          orderBy: {
            technology: {
              name: 'asc',
            },
          },
        },
      },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    return this.mapPublicResource(resource);
  }

  // Public API mapper
  // Prisma exposes technologies through the join relation `technologyLinks`.
  // The HTTP contract exposes a direct `technologies` array so callers do not
  // need to know the database join-table shape.
  private mapPublicResource(resource: {
    id: string;
    title: string;
    shortSummary: string | null;
    sourceUrl: string;
    canonicalUrl: string;
    publishedAt: Date | null;
    detectedAt: Date;
    lifecycleStatus: string;
    linkStatus: string;
    source: PublicResourceSource;
    category: PublicResourceCategory;
    technologyLinks: { technology: PublicResourceTechnology }[];
  }): PublicResourceItem {
    return {
      id: resource.id,
      title: resource.title,
      shortSummary: resource.shortSummary,
      sourceUrl: resource.sourceUrl,
      canonicalUrl: resource.canonicalUrl,
      publishedAt: resource.publishedAt,
      detectedAt: resource.detectedAt,
      lifecycleStatus: resource.lifecycleStatus,
      linkStatus: resource.linkStatus,
      source: resource.source,
      category: resource.category,
      technologies: resource.technologyLinks.map(
        (technologyLink) => technologyLink.technology,
      ),
    };
  }
}
