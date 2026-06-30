import { Injectable } from '@nestjs/common';

import {
  classifyLinkCheckResult,
  type LinkCheckResult,
  type LinkCheckStatus,
} from './link-check-result.js';

export interface LinkCheckResource {
  id: string;
  sourceUrl: string;
}

export interface LinkCheckResourceRepository {
  findResourcesForLinkCheck(args: {
    limit: number;
  }): Promise<LinkCheckResource[]>;
  updateResourceLinkStatus(args: {
    resourceId: string;
    linkStatus: LinkCheckStatus;
    checkedAt: Date;
  }): Promise<void>;
}

export interface LinkChecker {
  checkLink(sourceUrl: string): Promise<LinkCheckResult>;
}

export interface RunLinkCheckJobInput {
  repository: LinkCheckResourceRepository;
  checker: LinkChecker;
  limit?: number;
  checkedAt?: Date;
}

export interface LinkCheckJobResourceResult {
  resourceId: string;
  sourceUrl: string;
  status: 'updated' | 'failed';
  linkStatus?: LinkCheckStatus;
  issueCode?: 'link_check_failed' | 'link_status_update_failed';
}

export interface LinkCheckJobResult {
  checkedResourceCount: number;
  updatedResourceCount: number;
  failedResourceCount: number;
  resources: LinkCheckJobResourceResult[];
}

const DEFAULT_LINK_CHECK_LIMIT = 20;

@Injectable()
export class LinkChecksService {
  // Classification facade
  // The service is the NestJS entry point that future jobs/controllers can
  // inject. The pure helper still owns the rule, so this class can grow toward
  // orchestration without duplicating business logic.
  classifyResult(result: LinkCheckResult): LinkCheckStatus {
    return classifyLinkCheckResult(result);
  }

  // Batch orchestration
  // Dependencies are passed as ports for now: tests provide fakes, and a later
  // micro-increment can adapt Prisma/fetch to these contracts without changing
  // the business loop. This mirrors an Express service receiving explicit
  // collaborators instead of reaching directly into global clients.
  async runLinkCheckJob(
    input: RunLinkCheckJobInput,
  ): Promise<LinkCheckJobResult> {
    const limit = input.limit ?? DEFAULT_LINK_CHECK_LIMIT;
    const checkedAt = input.checkedAt ?? new Date();
    const resources = await input.repository.findResourcesForLinkCheck({
      limit,
    });
    const resourceResults: LinkCheckJobResourceResult[] = [];

    for (const resource of resources) {
      resourceResults.push(
        await this.checkAndPersistResourceLink(resource, input, checkedAt),
      );
    }

    return this.buildJobResult(resourceResults);
  }

  private async checkAndPersistResourceLink(
    resource: LinkCheckResource,
    input: RunLinkCheckJobInput,
    checkedAt: Date,
  ): Promise<LinkCheckJobResourceResult> {
    let issueCode: LinkCheckJobResourceResult['issueCode'];
    let checkResult: LinkCheckResult;

    try {
      checkResult = await input.checker.checkLink(resource.sourceUrl);
    } catch {
      checkResult = { kind: 'network_error' };
      issueCode = 'link_check_failed';
    }

    const linkStatus = this.classifyResult(checkResult);

    try {
      await input.repository.updateResourceLinkStatus({
        resourceId: resource.id,
        linkStatus,
        checkedAt,
      });
    } catch {
      return {
        resourceId: resource.id,
        sourceUrl: resource.sourceUrl,
        status: 'failed',
        issueCode: 'link_status_update_failed',
      };
    }

    return {
      resourceId: resource.id,
      sourceUrl: resource.sourceUrl,
      status: 'updated',
      linkStatus,
      ...(issueCode === undefined ? {} : { issueCode }),
    };
  }

  private buildJobResult(
    resources: LinkCheckJobResourceResult[],
  ): LinkCheckJobResult {
    const updatedResourceCount = resources.filter(
      (resource) => resource.status === 'updated',
    ).length;

    return {
      checkedResourceCount: resources.length,
      updatedResourceCount,
      failedResourceCount: resources.length - updatedResourceCount,
      resources,
    };
  }
}
