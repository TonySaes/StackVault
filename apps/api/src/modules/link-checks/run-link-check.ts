import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

import { PrismaService } from '../../database/prisma.service.js';
import { FetchLinkChecker } from './fetch-link-checker.js';
import { LinkChecksService } from './link-checks.service.js';
import { PrismaLinkCheckResourceRepository } from './prisma-link-check-resource.repository.js';
import {
  formatLinkCheckRunSummary,
  parseLinkCheckRunOptions,
  shouldPrintLinkCheckUsage,
} from './run-link-check-options.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDir, '../../../.env') });

const [, , ...commandArgs] = process.argv;

function printUsage() {
  console.error(`Usage: npm run -w apps/api link-check:run -- [--limit 20]`);
  console.error(`Exemple: npm run -w apps/api link-check:run -- --limit 10`);
}

function logResourceResults(
  resources: Awaited<ReturnType<LinkChecksService['runLinkCheckJob']>>['resources'],
) {
  for (const resource of resources) {
    const issueSuffix =
      resource.issueCode === undefined ? '' : `, signalement: ${resource.issueCode}`;
    const linkStatusSuffix =
      resource.linkStatus === undefined ? '' : `, statut: ${resource.linkStatus}`;

    console.log(
      `- ${resource.status}: ${resource.resourceId}${linkStatusSuffix}${issueSuffix}`,
    );
  }
}

async function main() {
  if (shouldPrintLinkCheckUsage(commandArgs)) {
    printUsage();

    return;
  }

  const options = parseLinkCheckRunOptions(commandArgs);
  const prisma = new PrismaService();
  const service = new LinkChecksService();
  const repository = new PrismaLinkCheckResourceRepository(prisma);
  const checker = new FetchLinkChecker();

  try {
    const result = await service.runLinkCheckJob({
      repository,
      checker,
      limit: options.limit,
    });

    console.log(formatLinkCheckRunSummary(result));
    logResourceResults(result.resources);

    if (result.failedResourceCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error && error.message === 'link_check.limit_invalid') {
    console.error('Limite de verification invalide.');
    printUsage();
  } else {
    console.error('Verification des liens echouee.');
  }

  process.exitCode = 1;
});
