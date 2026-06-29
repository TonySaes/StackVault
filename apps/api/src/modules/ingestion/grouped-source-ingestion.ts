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
