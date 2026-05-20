import { Controller, Get, Inject, Query } from '@nestjs/common';

import { ListResourcesQueryDto } from './dto/list-resources-query.dto.js';
import {
  PaginatedResourcesResponse,
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
}
