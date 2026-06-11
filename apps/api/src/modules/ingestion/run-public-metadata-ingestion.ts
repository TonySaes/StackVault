import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

import {
  createIngestionErrorLogPersistence,
  recordIngestionReportErrors,
  type IngestionErrorLogWriter,
} from './ingestion-error-log.js';
import {
  createManualDemoIngestionPersistence,
  loadManualDemoIngestionContext,
  type ManualDemoIngestionCatalogReader,
  type ManualDemoIngestionResourceWriter,
} from './manual-demo-ingestion.js';
import {
  runPublicMetadataIngestion,
  type PublicMetadataIngestionSource,
  type PublicMetadataPageFetcher,
} from './public-metadata-ingestion-adapter.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDir, '../../../.env') });

const prisma = new PrismaClient();

// Command arguments
// `sourceUrl` is the exact allowlisted public page stored in the database. This
// local trigger does not crawl links found on that page.
const [, , sourceUrl] = process.argv;

// Local Prisma adapters
// The command only exposes the read/write ports needed by the ingestion flow.
// It stays a manual trigger, not a NestJS controller, cron or scheduler.
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

const errorLogWriter: IngestionErrorLogWriter = {
  ingestionError: {
    create: (args) => prisma.ingestionError.create(args),
    findMany: (args) => prisma.ingestionError.findMany(args),
    deleteMany: (args) => prisma.ingestionError.deleteMany(args),
  },
};

const fetchPage: PublicMetadataPageFetcher = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`page.fetchFailed:${response.status}`);
  }

  return response.text();
};

function inferDefaultTechnologyFromSourceName(sourceName: string) {
  const normalizedSourceName = sourceName.toLowerCase();

  if (normalizedSourceName.includes('node')) {
    return 'Node.js';
  }

  if (normalizedSourceName.includes('postgresql')) {
    return 'PostgreSQL';
  }

  if (normalizedSourceName.includes('prisma')) {
    return 'Prisma';
  }

  return undefined;
}

function printUsage() {
  console.error(
    `Usage: npm run -w apps/api ingestion:public-metadata -- <source-url>`,
  );
  console.error(
    `Exemple: npm run -w apps/api ingestion:public-metadata -- https://nodejs.org/en/blog`,
  );
}

function buildPublicMetadataSource(
  source: Awaited<ReturnType<typeof findSourceByUrl>>,
): PublicMetadataIngestionSource {
  if (!source) {
    throw new Error('source.notFound');
  }

  const publicMetadataSource: PublicMetadataIngestionSource = {
    id: source.id,
    name: source.name,
    url: source.url,
    status: source.status,
    type: source.type,
  };
  const defaultTechnology = inferDefaultTechnologyFromSourceName(source.name);

  if (defaultTechnology !== undefined) {
    publicMetadataSource.defaultTechnology = defaultTechnology;
  }

  return publicMetadataSource;
}

function logAdapterEntries(
  entries: Awaited<
    ReturnType<typeof runPublicMetadataIngestion>
  >['adapter']['entries'],
) {
  for (const entry of entries) {
    const issueCodes = [...entry.warnings, ...entry.errors].map(
      (issue) => issue.code,
    );
    const issueSuffix =
      issueCodes.length > 0 ? `, signalements: ${issueCodes.join(', ')}` : '';

    console.log(`- adapter:${entry.status}: ${entry.title}${issueSuffix}`);
  }
}

function logIngestionItems(
  items: Awaited<
    ReturnType<typeof runPublicMetadataIngestion>
  >['ingestion']['items'],
) {
  for (const item of items) {
    const issueCodes = [...item.warnings, ...item.errors].map(
      (issue) => issue.code,
    );
    const issueSuffix =
      issueCodes.length > 0 ? `, signalements: ${issueCodes.join(', ')}` : '';

    console.log(`- ingestion:${item.status}: ${item.title}${issueSuffix}`);
  }
}

function hasBlockingIssues(
  result: Awaited<ReturnType<typeof runPublicMetadataIngestion>>,
) {
  return (
    result.adapter.entries.some((entry) => entry.errors.length > 0) ||
    result.ingestion.skippedCount > 0 ||
    result.ingestion.items.some((item) => item.errors.length > 0)
  );
}

async function findSourceByUrl(rawSourceUrl: string) {
  return prisma.source.findUnique({
    where: {
      url: rawSourceUrl,
    },
    select: {
      id: true,
      name: true,
      url: true,
      status: true,
      type: true,
    },
  });
}

async function main() {
  if (!sourceUrl) {
    printUsage();
    process.exitCode = 1;

    return;
  }

  const source = buildPublicMetadataSource(await findSourceByUrl(sourceUrl));
  const normalizationContext =
    await loadManualDemoIngestionContext(catalogReader);
  const persistence = createManualDemoIngestionPersistence(resourceWriter);
  const errorLogPersistence =
    createIngestionErrorLogPersistence(errorLogWriter);
  const result = await runPublicMetadataIngestion(source, {
    fetchPage,
    normalizationContext,
    persistence,
  });
  const recordedErrorCount = await recordIngestionReportErrors(
    {
      source,
      report: result,
      adapterLabel: 'Public metadata adapter',
      ingestionLabel: 'Public metadata ingestion',
    },
    {
      persistence: errorLogPersistence,
    },
  );

  console.log(
    `Ingestion metadonnees publiques terminee: ${result.adapter.items.length} items adaptes, ${result.ingestion.createdCount} crees, ${result.ingestion.updatedCount} mis a jour, ${result.ingestion.skippedCount} ignores.`,
  );
  console.log(`Erreurs d'ingestion journalisees: ${recordedErrorCount}.`);
  logAdapterEntries(result.adapter.entries);
  logIngestionItems(result.ingestion.items);

  if (hasBlockingIssues(result)) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    if (error instanceof Error && error.message === 'source.notFound') {
      console.error(`Source allowlistee introuvable pour l'URL fournie.`);
    } else {
      console.error('Ingestion metadonnees publiques echouee.');
      console.error(error);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
