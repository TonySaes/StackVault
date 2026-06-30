import { Injectable } from '@nestjs/common';

import {
  classifyLinkCheckResult,
  type LinkCheckResult,
  type LinkCheckStatus,
} from './link-check-result.js';

@Injectable()
export class LinkChecksService {
  // Classification facade
  // The service is the NestJS entry point that future jobs/controllers can
  // inject. The pure helper still owns the rule, so this class can grow toward
  // orchestration without duplicating business logic.
  classifyResult(result: LinkCheckResult): LinkCheckStatus {
    return classifyLinkCheckResult(result);
  }
}
