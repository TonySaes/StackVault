import { Module } from '@nestjs/common';

import { LinkChecksService } from './link-checks.service.js';

@Module({
  providers: [LinkChecksService],
  exports: [LinkChecksService],
})
export class LinkChecksModule {}
