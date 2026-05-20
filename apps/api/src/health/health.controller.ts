import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';

import { HealthResponse, HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthService)
    private readonly healthService: HealthService,
  ) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    const health = await this.healthService.getHealth();

    if (health.status === 'degraded') {
      throw new ServiceUnavailableException(health);
    }

    return health;
  }
}
