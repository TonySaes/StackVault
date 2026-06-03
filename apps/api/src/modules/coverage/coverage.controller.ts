import { Controller, Get, Inject } from '@nestjs/common';

import {
  CoverageService,
  PublicCoverageResponse,
} from './coverage.service.js';

@Controller('coverage')
export class CoverageController {
  constructor(
    @Inject(CoverageService)
    private readonly coverageService: CoverageService,
  ) {}

  @Get()
  async getPublicCoverage(): Promise<PublicCoverageResponse> {
    return this.coverageService.getPublicCoverage();
  }
}
