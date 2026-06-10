import type { IngestionItem } from './ingestion-item.js';

// RSS/Atom source contract
// `Source.type` is a plain Prisma string today. This constant gives the adapter
// a shared value without requiring a schema migration.
export const RSS_ATOM_SOURCE_TYPE = 'rss_atom';

export interface RssAtomIngestionSource {
  id: string;
  name: string;
  url: string;
  status: string;
  type: string;
}

// Fetch boundary
// The adapter receives feed XML through this function instead of calling
// `fetch` directly. Tests can replace it with a fixture loader, like an Express
// handler would receive a mocked HTTP client instead of calling the network.
export type RssAtomFeedFetcher = (sourceUrl: string) => Promise<string>;

export interface RssAtomIngestionDependencies {
  fetchFeed: RssAtomFeedFetcher;
}

// Parser boundary
// `fast-xml-parser` will live behind this boundary in the next increment. Its
// job is only to turn RSS/Atom XML into metadata candidates, never to persist or
// echo full third-party article bodies.
export interface RssAtomParsedFeedEntry {
  title: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  summary: string | null;
  categories: string[];
}

// Adapter feedback
// These small codes keep reports actionable without leaking raw XML, HTML or
// external provider payloads into logs or public responses.
export type RssAtomIngestionErrorCode =
  | 'source.inactive'
  | 'source.typeUnsupported'
  | 'feed.fetchFailed'
  | 'feed.parseFailed'
  | 'entry.titleMissing'
  | 'entry.sourceUrlMissing'
  | 'entry.sourceUrlInvalid'
  | 'entry.summaryTooLong';

export type RssAtomIngestionWarningCode =
  | 'entry.categoryMissing'
  | 'entry.technologyMissing';

export interface RssAtomIngestionIssue {
  code: RssAtomIngestionErrorCode | RssAtomIngestionWarningCode;
  field: string;
}

export type RssAtomIngestionEntryStatus = 'mapped' | 'skipped';

export interface RssAtomIngestionEntryReport {
  title: string;
  sourceUrl: string;
  status: RssAtomIngestionEntryStatus;
  warnings: RssAtomIngestionIssue[];
  errors: RssAtomIngestionIssue[];
}

// Adapter result
// The rest of the ingestion pipeline already understands `IngestionItem`.
// Keeping this output narrow prevents the adapter from becoming a second
// normalizer or a persistence service.
export interface RssAtomIngestionAdapterResult {
  items: IngestionItem[];
  entries: RssAtomIngestionEntryReport[];
}
