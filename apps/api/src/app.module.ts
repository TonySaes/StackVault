import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import { CoverageModule } from './modules/coverage/coverage.module.js';
import { ResourcesModule } from './modules/resources/resources.module.js';

@Module({
  imports: [DatabaseModule, ResourcesModule, CoverageModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
