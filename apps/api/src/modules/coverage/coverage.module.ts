import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module.js';
import { CoverageController } from './coverage.controller.js';
import { CoverageService } from './coverage.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CoverageController],
  providers: [CoverageService],
})
export class CoverageModule {}
