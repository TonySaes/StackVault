import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module.js';
import { LinkChecksService } from './link-checks.service.js';
import { PrismaLinkCheckResourceRepository } from './prisma-link-check-resource.repository.js';

@Module({
  imports: [DatabaseModule],
  providers: [LinkChecksService, PrismaLinkCheckResourceRepository],
  exports: [LinkChecksService, PrismaLinkCheckResourceRepository],
})
export class LinkChecksModule {}
