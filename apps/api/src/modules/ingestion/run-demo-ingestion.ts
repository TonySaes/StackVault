import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

import { demoIngestionItems } from './demo-ingestion-items.js';
import {
  createManualDemoIngestionPersistence,
  loadManualDemoIngestionContext,
  runManualDemoIngestion,
  type ManualDemoIngestionCatalogReader,
  type ManualDemoIngestionResourceWriter,
} from './manual-demo-ingestion.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDir, '../../../.env') });

const prisma = new PrismaClient();

// Local Prisma adapters
// The command passes only the Prisma delegates required by the manual ingestion
// flow. This keeps the local trigger explicit and avoids introducing an HTTP
// route, automated trigger or external feed adapter.
const catalogReader: ManualDemoIngestionCatalogReader = {
  source: {
    findMany: (args) => prisma.source.findMany(args),
  },
  category: {
    findMany: (args) => prisma.category.findMany(args),
  },
  technology: {
    findMany: (args) => prisma.technology.findMany(args),
  },
};

const resourceWriter: ManualDemoIngestionResourceWriter = {
  resource: {
    findUnique: (args) => prisma.resource.findUnique(args),
    upsert: (args) => prisma.resource.upsert(args),
  },
  resourceTechnology: {
    deleteMany: (args) => prisma.resourceTechnology.deleteMany(args),
    upsert: (args) => prisma.resourceTechnology.upsert(args),
  },
  $transaction: (callback) =>
    prisma.$transaction((transaction) => callback(transaction)),
};

function logReportSummary(
  report: Awaited<ReturnType<typeof runManualDemoIngestion>>,
) {
  console.log(
    `Ingestion demo terminee: ${report.processedCount} traites, ${report.createdCount} crees, ${report.updatedCount} mis a jour, ${report.skippedCount} ignores.`,
  );

  for (const item of report.items) {
    const issueCodes = [...item.warnings, ...item.errors].map(
      (issue) => issue.code,
    );
    const issueSuffix =
      issueCodes.length > 0 ? `, signalements: ${issueCodes.join(', ')}` : '';

    console.log(`- ${item.status}: ${item.title}${issueSuffix}`);
  }
}

function hasBlockingReportIssues(
  report: Awaited<ReturnType<typeof runManualDemoIngestion>>,
) {
  return (
    report.skippedCount > 0 ||
    report.items.some((item) => item.errors.length > 0)
  );
}

async function main() {
  const normalizationContext =
    await loadManualDemoIngestionContext(catalogReader);
  const persistence = createManualDemoIngestionPersistence(resourceWriter);
  const report = await runManualDemoIngestion(demoIngestionItems, {
    normalizationContext,
    persistence,
  });

  logReportSummary(report);

  if (hasBlockingReportIssues(report)) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error('Ingestion demo echouee.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
