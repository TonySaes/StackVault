import {
  recordIngestionError,
  recordIngestionReportErrors,
  type RecordIngestionErrorDependencies,
} from './ingestion-error-log.js';
import {
  PUBLIC_METADATA_SOURCE_TYPE,
  runPublicMetadataIngestion,
  type PublicMetadataIngestionRunDependencies,
} from './public-metadata-ingestion-adapter.js';
import {
  RSS_ATOM_SOURCE_TYPE,
  runRssAtomIngestion,
  type RssAtomIngestionRunDependencies,
} from './rss-atom-ingestion-adapter.js';

// Grouped source ingestion contract
// This file keeps the batch contract, adapter routing and source-by-source
// orchestration together so callers get one stable entry point for grouped runs.
export const GROUPED_SOURCE_INGESTION_UNSUPPORTED_TYPE_ERROR =
  'source.typeUnsupported';
export const GROUPED_SOURCE_INGESTION_UNEXPECTED_ERROR =
  'source.ingestionFailed';

export type GroupedSourceIngestionSourceStatus = 'succeeded' | 'failed';

export interface GroupedSourceIngestionSource {
  id: string;
  name: string;
  url: string;
  type: string;
  status: string;
  feedUrl?: string;
  defaultTechnology?: string;
}

export interface GroupedSourceIngestionIssue {
  code: string;
  field: string;
}

// Per-source result
// A failed source still has its own result. This is the core isolation contract:
// callers can inspect the failed source while successful sources keep their
// created or updated resources.
export interface GroupedSourceIngestionSourceResult {
  source: GroupedSourceIngestionSource;
  status: GroupedSourceIngestionSourceStatus;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  recordedErrorCount: number;
  errors: GroupedSourceIngestionIssue[];
}

// Batch result
// These counters are derived from source-level results. They make CLI output
// and future admin diagnostics explicit without introducing an `IngestionRun`
// database table in this story.
export interface GroupedSourceIngestionResult {
  processedSourceCount: number;
  succeededSourceCount: number;
  failedSourceCount: number;
  sources: GroupedSourceIngestionSourceResult[];
}

export interface GroupedSourceIngestionReportEntry {
  warnings?: GroupedSourceIngestionIssue[];
  errors: GroupedSourceIngestionIssue[];
}

export interface GroupedSourceIngestionReport {
  adapter: {
    entries: GroupedSourceIngestionReportEntry[];
  };
  ingestion: {
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    items: GroupedSourceIngestionReportEntry[];
  };
}

export type GroupedSourceFailureRecorder = (
  source: GroupedSourceIngestionSource,
  issue: GroupedSourceIngestionIssue,
) => Promise<number>;

export interface GroupedSourceIngestionDependencies {
  runSourceIngestion(
    source: GroupedSourceIngestionSource,
  ): Promise<GroupedSourceIngestionSourceResult>;
  recordSourceFailure: GroupedSourceFailureRecorder;
  isSourceTypeSupported?(source: GroupedSourceIngestionSource): boolean;
}

export interface GroupedSourceIngestionRunnerOverrides {
  runRssAtomSource?: typeof runRssAtomIngestion;
  runPublicMetadataSource?: typeof runPublicMetadataIngestion;
}

export interface CreateGroupedSourceIngestionDependencies
  extends RssAtomIngestionRunDependencies,
    PublicMetadataIngestionRunDependencies {
  errorLog: RecordIngestionErrorDependencies;
  runners?: GroupedSourceIngestionRunnerOverrides;
}

// Batch summary mapping
// This helper only turns per-source facts into stable counters, which keeps the
// reporting rule easy to test before external adapters or Prisma are involved.
export function buildGroupedSourceIngestionResult(
  sourceResults: readonly GroupedSourceIngestionSourceResult[],
): GroupedSourceIngestionResult {
  const sources = [...sourceResults];

  return {
    processedSourceCount: sources.length,
    succeededSourceCount: sources.filter(
      (source) => source.status === 'succeeded',
    ).length,
    failedSourceCount: sources.filter((source) => source.status === 'failed')
      .length,
    sources,
  };
}

function collectReportErrors(
  report: GroupedSourceIngestionReport,
): GroupedSourceIngestionIssue[] {
  return [
    ...report.adapter.entries.flatMap((entry) => entry.errors),
    ...report.ingestion.items.flatMap((item) => item.errors),
  ];
}

// Report-to-source result mapping
// RSS/Atom and public metadata runs already expose the same high-level shape:
// adapter issues plus ingestion item issues. This mapper keeps grouped
// orchestration independent from each concrete adapter. Warnings stay out of
// the failure decision; only explicit errors make the source failed.
export function buildGroupedSourceResultFromReport(
  source: GroupedSourceIngestionSource,
  report: GroupedSourceIngestionReport,
  recordedErrorCount: number,
): GroupedSourceIngestionSourceResult {
  const errors = collectReportErrors(report);

  return {
    source,
    status: errors.length > 0 ? 'failed' : 'succeeded',
    createdCount: report.ingestion.createdCount,
    updatedCount: report.ingestion.updatedCount,
    skippedCount: report.ingestion.skippedCount,
    recordedErrorCount,
    errors,
  };
}

function buildUnexpectedFailureIssue(): GroupedSourceIngestionIssue {
  return {
    code: GROUPED_SOURCE_INGESTION_UNEXPECTED_ERROR,
    field: 'source',
  };
}

function buildUnsupportedTypeIssue(): GroupedSourceIngestionIssue {
  return {
    code: GROUPED_SOURCE_INGESTION_UNSUPPORTED_TYPE_ERROR,
    field: 'type',
  };
}

function buildFailureSourceResult(
  source: GroupedSourceIngestionSource,
  issue: GroupedSourceIngestionIssue,
  recordedErrorCount: number,
): GroupedSourceIngestionSourceResult {
  return {
    source,
    status: 'failed',
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    recordedErrorCount,
    errors: [issue],
  };
}

async function recordSourceFailureSafely(
  source: GroupedSourceIngestionSource,
  issue: GroupedSourceIngestionIssue,
  dependencies: GroupedSourceIngestionDependencies,
): Promise<number> {
  try {
    return await dependencies.recordSourceFailure(source, issue);
  } catch {
    return 0;
  }
}

function isSourceSupported(
  source: GroupedSourceIngestionSource,
  dependencies: GroupedSourceIngestionDependencies,
): boolean {
  return dependencies.isSourceTypeSupported?.(source) ?? true;
}

// Error-log adapter
// Grouped ingestion only knows that one source failed. This adapter translates
// that local issue into the Story 2.8 ingestion error logger without exposing
// Prisma or raw thrown errors to the orchestration loop.
export function createGroupedSourceFailureRecorder(
  dependencies: RecordIngestionErrorDependencies,
): GroupedSourceFailureRecorder {
  return async (source, issue) => {
    await recordIngestionError(
      {
        source,
        errorType: issue.code,
        message: `Grouped source ingestion error ${issue.code} on ${issue.field}.`,
      },
      dependencies,
    );

    return 1;
  };
}

export function isGroupedSourceTypeSupported(
  source: GroupedSourceIngestionSource,
): boolean {
  return (
    source.type === RSS_ATOM_SOURCE_TYPE ||
    source.type === PUBLIC_METADATA_SOURCE_TYPE
  );
}

// Adapter routing
// This factory is the narrow bridge to real source adapters. Tests can override
// the two runners, while production callers get the existing RSS/Atom and
// public metadata pipelines by default.
export function createGroupedSourceIngestionDependencies(
  dependencies: CreateGroupedSourceIngestionDependencies,
): GroupedSourceIngestionDependencies {
  const runRssAtomSource =
    dependencies.runners?.runRssAtomSource ?? runRssAtomIngestion;
  const runPublicMetadataSource =
    dependencies.runners?.runPublicMetadataSource ?? runPublicMetadataIngestion;

  return {
    isSourceTypeSupported: isGroupedSourceTypeSupported,
    recordSourceFailure: createGroupedSourceFailureRecorder(
      dependencies.errorLog,
    ),
    async runSourceIngestion(source) {
      const report =
        source.type === RSS_ATOM_SOURCE_TYPE
          ? await runRssAtomSource(source, dependencies)
          : await runPublicMetadataSource(source, dependencies);
      const recordedErrorCount = await recordIngestionReportErrors(
        {
          source,
          report,
          adapterLabel:
            source.type === RSS_ATOM_SOURCE_TYPE
              ? 'RSS/Atom adapter'
              : 'Public metadata adapter',
          ingestionLabel:
            source.type === RSS_ATOM_SOURCE_TYPE
              ? 'RSS/Atom ingestion'
              : 'Public metadata ingestion',
        },
        dependencies.errorLog,
      );

      return buildGroupedSourceResultFromReport(
        source,
        report,
        recordedErrorCount,
      );
    },
  };
}

// Sequential orchestration
// Each source owns its local failure boundary. This is the equivalent of
// putting the `try/catch` inside the loop in a Node.js service so the next
// source can still run after one provider fails.
export async function runGroupedSourceIngestion(
  sources: readonly GroupedSourceIngestionSource[],
  dependencies: GroupedSourceIngestionDependencies,
): Promise<GroupedSourceIngestionResult> {
  const sourceResults: GroupedSourceIngestionSourceResult[] = [];

  for (const source of sources) {
    if (!isSourceSupported(source, dependencies)) {
      const issue = buildUnsupportedTypeIssue();
      const recordedErrorCount = await recordSourceFailureSafely(
        source,
        issue,
        dependencies,
      );

      sourceResults.push(
        buildFailureSourceResult(source, issue, recordedErrorCount),
      );

      continue;
    }

    try {
      sourceResults.push(await dependencies.runSourceIngestion(source));
    } catch {
      const issue = buildUnexpectedFailureIssue();
      const recordedErrorCount = await recordSourceFailureSafely(
        source,
        issue,
        dependencies,
      );

      sourceResults.push(
        buildFailureSourceResult(source, issue, recordedErrorCount),
      );
    }
  }

  return buildGroupedSourceIngestionResult(sourceResults);
}
