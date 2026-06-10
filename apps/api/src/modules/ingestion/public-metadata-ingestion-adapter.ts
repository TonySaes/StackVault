import { type IngestionItem } from './ingestion-item.js';

// Public metadata source contract
// `Source.type` stays a plain Prisma string for now. This constant gives the
// adapter a shared value without introducing a schema migration or enum.
export const PUBLIC_METADATA_SOURCE_TYPE = 'public_metadata';

export interface PublicMetadataIngestionSource {
  id: string;
  name: string;
  url: string;
  defaultTechnology?: string;
  status: string;
  type: string;
}

// Fetch boundary
// The adapter receives page HTML through this function instead of calling
// `fetch` directly. Tests can inject a local fixture, like an Express handler
// would receive a mocked HTTP client instead of touching the network.
export type PublicMetadataPageFetcher = (sourceUrl: string) => Promise<string>;

export interface PublicMetadataIngestionDependencies {
  fetchPage: PublicMetadataPageFetcher;
}

// Parser boundary
// This intermediate shape is intentionally metadata-only. It may hold a short
// public description, but it must never carry the raw HTML page or article body.
export interface PublicMetadataParsedPage {
  title: string | null;
  sourceUrl: string;
  publishedAt: string | null;
  summary: string | null;
}

// Adapter feedback
// Small stable codes keep reports actionable without exposing raw HTML, provider
// payloads, stack traces or implementation details.
export type PublicMetadataIngestionErrorCode =
  | 'source.inactive'
  | 'source.typeUnsupported'
  | 'page.fetchFailed'
  | 'page.parseFailed'
  | 'metadata.titleMissing'
  | 'metadata.titleTooLong'
  | 'metadata.summaryTooLong';

export type PublicMetadataIngestionWarningCode =
  | 'metadata.categoryMissing'
  | 'metadata.technologyMissing'
  | 'metadata.summaryMissing'
  | 'metadata.publishedAtMissing';

export interface PublicMetadataIngestionIssue {
  code:
    | PublicMetadataIngestionErrorCode
    | PublicMetadataIngestionWarningCode;
  field: string;
}

export type PublicMetadataIngestionEntryStatus = 'mapped' | 'skipped';

export interface PublicMetadataIngestionEntryReport {
  title: string;
  sourceUrl: string;
  status: PublicMetadataIngestionEntryStatus;
  warnings: PublicMetadataIngestionIssue[];
  errors: PublicMetadataIngestionIssue[];
}

// Adapter result
// The rest of the ingestion pipeline already speaks `IngestionItem`. Keeping
// this output narrow prevents the adapter from becoming a parser, normalizer and
// persistence service at the same time.
export interface PublicMetadataIngestionAdapterResult {
  items: IngestionItem[];
  entries: PublicMetadataIngestionEntryReport[];
}
