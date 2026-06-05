import type {
  IngestionNormalizationIssue,
  NormalizedResourceDraft,
} from './normalize-ingestion-item.js';

// Persistence boundary
// The manual ingestion flow will depend on this small port instead of calling
// Prisma directly from every step.
export interface ManualDemoIngestionPersistencePort {
  upsertResourceDraft(
    draft: NormalizedResourceDraft,
  ): Promise<ManualDemoIngestionPersistenceResult>;
}

export interface ManualDemoIngestionPersistenceResult {
  resourceId: string;
  operation: 'created' | 'updated';
}

// Item-level report
// Each input item produces a compact result. The report exposes business status
// and issue codes, but never echoes raw third-party content or full payloads.
export type ManualDemoIngestionItemStatus =
  | 'created'
  | 'updated'
  | 'skipped';

export interface ManualDemoIngestionItemReport {
  title: string;
  sourceUrl: string;
  status: ManualDemoIngestionItemStatus;
  canonicalUrl?: string;
  resourceId?: string;
  warnings: IngestionNormalizationIssue[];
  errors: IngestionNormalizationIssue[];
}

// Run-level report
// The future local command can print this shape safely after execution.
export interface ManualDemoIngestionReport {
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  items: ManualDemoIngestionItemReport[];
}
