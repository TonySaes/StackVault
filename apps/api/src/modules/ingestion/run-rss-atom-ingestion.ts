import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

import {
  createIngestionErrorLogPersistence,
  recordIngestionError,
  type IngestionErrorLogPersistencePort,
  type IngestionErrorLogSource,
  type IngestionErrorLogWriter,
} from './ingestion-error-log.js';
import {
  createManualDemoIngestionPersistence,
  loadManualDemoIngestionContext,
  type ManualDemoIngestionCatalogReader,
  type ManualDemoIngestionResourceWriter,
} from './manual-demo-ingestion.js';
import {
  runRssAtomIngestion,
  type RssAtomFeedFetcher,
  type RssAtomIngestionSource,
} from './rss-atom-ingestion-adapter.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDir, '../../../.env') });

const prisma = new PrismaClient();

// Command arguments
// `sourceUrl` is the allowlisted article perimeter stored in the database.
// `feedUrl` is the optional technical RSS/Atom endpoint used for this local run.
const [, , sourceUrl, feedUrl] = process.argv;

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

const fetchFeed: RssAtomFeedFetcher = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`feed.fetchFailed:${response.status}`);
  }

  return response.text();
};

function inferDefaultTechnologyFromSourceName(sourceName: string) {
  const normalizedSourceName = sourceName.toLowerCase();

  if (normalizedSourceName.includes('react')) {
    return 'React';
  }

  return undefined;
}

function printUsage() {
  console.error(
    `Usage: npm run -w apps/api ingestion:rss-atom -- <source-url> [feed-url]`,
  );
  console.error(
    `Exemple: npm run -w apps/api ingestion:rss-atom -- https://react.dev/blog https://react.dev/rss.xml`,
  );
}

function buildRssAtomSource(
  source: Awaited<ReturnType<typeof findSourceByUrl>>,
): RssAtomIngestionSource {
  if (!source) {
    throw new Error('source.notFound');
  }

  const rssAtomSource: RssAtomIngestionSource = {
    id: source.id,
    name: source.name,
    url: source.url,
    status: source.status,
    type: source.type,
  };
  const defaultTechnology = inferDefaultTechnologyFromSourceName(source.name);

  if (feedUrl !== undefined) {
    rssAtomSource.feedUrl = feedUrl;
  }

  if (defaultTechnology !== undefined) {
    rssAtomSource.defaultTechnology = defaultTechnology;
  }

  return rssAtomSource;
}

function logAdapterEntries(
  entries: Awaited<ReturnType<typeof runRssAtomIngestion>>['adapter']['entries'],
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
  items: Awaited<ReturnType<typeof runRssAtomIngestion>>['ingestion']['items'],
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
  result: Awaited<ReturnType<typeof runRssAtomIngestion>>,
) {
  return (
    result.adapter.entries.some((entry) => entry.errors.length > 0) ||
    result.ingestion.skippedCount > 0 ||
    result.ingestion.items.some((item) => item.errors.length > 0)
  );
}

async function recordRssAtomIngestionErrors(
  source: IngestionErrorLogSource,
  result: Awaited<ReturnType<typeof runRssAtomIngestion>>,
  errorLogPersistence: IngestionErrorLogPersistencePort,
) {
  let recordedCount = 0;

  // Adapter errors describe source/feed failures before normalization.
  // Warnings stay out of the persistent error log to keep future admin screens
  // focused on blockers rather than low-priority quality signals.
  for (const entry of result.adapter.entries) {
    for (const error of entry.errors) {
      await recordIngestionError(
        {
          source,
          errorType: error.code,
          message: `RSS/Atom adapter error ${error.code} on ${error.field}.`,
        },
        {
          persistence: errorLogPersistence,
        },
      );
      recordedCount += 1;
    }
  }

  // Ingestion errors happen after adaptation: validation, normalization,
  // canonical deduplication or persistence. They use the same source snapshot
  // so the future admin log can group failures by allowlisted source.
  for (const item of result.ingestion.items) {
    for (const error of item.errors) {
      await recordIngestionError(
        {
          source,
          errorType: error.code,
          message: `RSS/Atom ingestion error ${error.code} on ${error.field}.`,
        },
        {
          persistence: errorLogPersistence,
        },
      );
      recordedCount += 1;
    }
  }

  return recordedCount;
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

  const source = buildRssAtomSource(await findSourceByUrl(sourceUrl));
  const normalizationContext =
    await loadManualDemoIngestionContext(catalogReader);
  const persistence = createManualDemoIngestionPersistence(resourceWriter);
  const errorLogPersistence =
    createIngestionErrorLogPersistence(errorLogWriter);
  const result = await runRssAtomIngestion(source, {
    fetchFeed,
    normalizationContext,
    persistence,
  });
  const recordedErrorCount = await recordRssAtomIngestionErrors(
    source,
    result,
    errorLogPersistence,
  );

  console.log(
    `Ingestion RSS/Atom terminee: ${result.adapter.items.length} items adaptes, ${result.ingestion.createdCount} crees, ${result.ingestion.updatedCount} mis a jour, ${result.ingestion.skippedCount} ignores.`,
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
      console.error('Ingestion RSS/Atom echouee.');
      console.error(error);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
