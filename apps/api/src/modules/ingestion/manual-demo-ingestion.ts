import {
  validateIngestionItem,
  type IngestionItemValidationError,
} from './ingestion-item.js';
import {
  type IngestionNormalizationIssue,
  normalizeIngestionItem,
  type IngestionNormalizationContext,
  type NormalizedResourceDraft,
} from './normalize-ingestion-item.js';

interface ReportableInput {
  title?: unknown;
  sourceUrl?: unknown;
}

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

export interface ManualDemoIngestionDependencies {
  normalizationContext: IngestionNormalizationContext;
  persistence: ManualDemoIngestionPersistencePort;
}

export interface ManualDemoIngestionDuplicateIssue {
  code: 'canonicalUrl.duplicate';
  field: 'canonicalUrl';
}

export type ManualDemoIngestionIssue =
  | IngestionItemValidationError
  | IngestionNormalizationIssue
  | ManualDemoIngestionDuplicateIssue;

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
  warnings: ManualDemoIngestionIssue[];
  errors: ManualDemoIngestionIssue[];
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

function getReportableInput(input: unknown): ReportableInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {};
  }

  return input as ReportableInput;
}

function getReportableString(input: unknown, fallback: string): string {
  return typeof input === 'string' && input.trim().length > 0
    ? input
    : fallback;
}

function buildSkippedItemReport(
  input: unknown,
  errors: ManualDemoIngestionIssue[],
): ManualDemoIngestionItemReport {
  const reportableInput = getReportableInput(input);

  return {
    title: getReportableString(reportableInput.title, 'invalid-title'),
    sourceUrl: getReportableString(
      reportableInput.sourceUrl,
      'invalid-source-url',
    ),
    status: 'skipped',
    warnings: [],
    errors,
  };
}

// Manual ingestion orchestration
// validate input, normalize metadata, deduplicate, then delegate DB
// writes through the injected persistence port.
export async function runManualDemoIngestion(
  items: readonly unknown[],
  dependencies: ManualDemoIngestionDependencies,
): Promise<ManualDemoIngestionReport> {
  const itemReports: ManualDemoIngestionItemReport[] = [];
  const seenCanonicalUrls = new Set<string>();

  for (const input of items) {
    const validation = validateIngestionItem(input);

    if (!validation.success) {
      itemReports.push(buildSkippedItemReport(input, validation.errors));

      continue;
    }

    const normalization = normalizeIngestionItem(
      validation.item,
      dependencies.normalizationContext,
    );

    if (!normalization.success) {
      itemReports.push(
        buildSkippedItemReport(validation.item, normalization.errors),
      );

      continue;
    }

    if (seenCanonicalUrls.has(normalization.draft.canonicalUrl)) {
      itemReports.push({
        title: validation.item.title,
        sourceUrl: validation.item.sourceUrl,
        status: 'skipped',
        canonicalUrl: normalization.draft.canonicalUrl,
        warnings: [{ code: 'canonicalUrl.duplicate', field: 'canonicalUrl' }],
        errors: [],
      });

      continue;
    }

    seenCanonicalUrls.add(normalization.draft.canonicalUrl);

    const persistenceResult =
      await dependencies.persistence.upsertResourceDraft(normalization.draft);

    itemReports.push({
      title: validation.item.title,
      sourceUrl: validation.item.sourceUrl,
      status: persistenceResult.operation,
      canonicalUrl: normalization.draft.canonicalUrl,
      resourceId: persistenceResult.resourceId,
      warnings: normalization.warnings,
      errors: [],
    });
  }

  return {
    processedCount: itemReports.length,
    createdCount: itemReports.filter((item) => item.status === 'created').length,
    updatedCount: itemReports.filter((item) => item.status === 'updated').length,
    skippedCount: itemReports.filter((item) => item.status === 'skipped').length,
    items: itemReports,
  };
}
