import { Controller, Get, Inject, Param, Query } from '@nestjs/common';

import { ListResourcesQueryDto } from './dto/list-resources-query.dto.js';
import {
  PaginatedResourcesResponse,
  PublicResourceItem,
  ResourcesService,
} from './resources.service.js';

@Controller('resources')
export class ResourcesController {
  constructor(
    @Inject(ResourcesService)
    private readonly resourcesService: ResourcesService,
  ) {}

  @Get()
  async listResources(
    @Query() query: ListResourcesQueryDto,
  ): Promise<PaginatedResourcesResponse> {
    return this.resourcesService.listResources(query);
  }

  @Get(':id')
  async getResourceById(
    @Param('id') resourceId: string,
  ): Promise<PublicResourceItem> {
    return this.resourcesService.getResourceById(resourceId);
  }
}
