import {
  recordIngestionError,
  type RecordIngestionErrorDependencies,
} from './ingestion-error-log.js';

// Grouped source ingestion contract
// This file describes the result shape before the orchestration logic exists.
// The next increments will use these types to run sources one by one without
// letting a single failure stop the whole ingestion batch.
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
}

// Batch summary mapping
// The orchestrator will own the loop later. This helper only turns per-source
// facts into stable counters, which makes the reporting rule easy to test
// before external adapters or Prisma are involved.
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
// orchestration independent from each concrete adapter.
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

function buildUnexpectedFailureSourceResult(
  source: GroupedSourceIngestionSource,
  recordedErrorCount: number,
): GroupedSourceIngestionSourceResult {
  const issue = buildUnexpectedFailureIssue();

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

async function recordUnexpectedFailure(
  source: GroupedSourceIngestionSource,
  dependencies: GroupedSourceIngestionDependencies,
): Promise<number> {
  try {
    return await dependencies.recordSourceFailure(
      source,
      buildUnexpectedFailureIssue(),
    );
  } catch {
    return 0;
  }
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
    try {
      sourceResults.push(await dependencies.runSourceIngestion(source));
    } catch {
      const recordedErrorCount = await recordUnexpectedFailure(
        source,
        dependencies,
      );

      sourceResults.push(
        buildUnexpectedFailureSourceResult(source, recordedErrorCount),
      );
    }
  }

  return buildGroupedSourceIngestionResult(sourceResults);
}
