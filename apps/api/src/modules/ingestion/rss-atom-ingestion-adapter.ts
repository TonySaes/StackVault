import { XMLParser } from 'fast-xml-parser';

import {
  MAX_INGESTION_SHORT_SUMMARY_LENGTH,
  type IngestionItem,
} from './ingestion-item.js';
import {
  type ManualDemoIngestionDependencies,
  type ManualDemoIngestionReport,
  runManualDemoIngestion,
} from './manual-demo-ingestion.js';

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

export interface RssAtomIngestionRunDependencies
  extends RssAtomIngestionDependencies,
    ManualDemoIngestionDependencies {}

export interface RssAtomIngestionRunResult {
  adapter: RssAtomIngestionAdapterResult;
  ingestion: ManualDemoIngestionReport;
}

type XmlRecord = Record<string, unknown>;

const XML_TEXT_NODE = '#text';
const XML_ATTRIBUTE_PREFIX = '@_';

const rssAtomXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: XML_ATTRIBUTE_PREFIX,
  textNodeName: XML_TEXT_NODE,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

function isRecord(input: unknown): input is XmlRecord {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function asArray(input: unknown): unknown[] {
  if (input === undefined || input === null) {
    return [];
  }

  return Array.isArray(input) ? input : [input];
}

function getStringValue(input: unknown): string | null {
  if (typeof input === 'string') {
    return input.trim().length > 0 ? input : null;
  }

  if (isRecord(input)) {
    return getStringValue(input[XML_TEXT_NODE]);
  }

  return null;
}

function getAttributeValue(input: unknown, attributeName: string): string | null {
  if (!isRecord(input)) {
    return null;
  }

  return getStringValue(input[`${XML_ATTRIBUTE_PREFIX}${attributeName}`]);
}

function isPublicHttpUrl(input: string): boolean {
  try {
    const url = new URL(input);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getRssChannel(parsedFeed: unknown): XmlRecord | null {
  if (!isRecord(parsedFeed) || !isRecord(parsedFeed.rss)) {
    return null;
  }

  return isRecord(parsedFeed.rss.channel) ? parsedFeed.rss.channel : null;
}

function parseCategoryValues(input: unknown): string[] {
  return asArray(input)
    .map(
      (category) =>
        getStringValue(category) ?? getAttributeValue(category, 'term'),
    )
    .filter((category): category is string => category !== null);
}

function parseRssEntry(item: unknown): RssAtomParsedFeedEntry | null {
  if (!isRecord(item)) {
    return null;
  }

  return {
    title: getStringValue(item.title),
    sourceUrl: getStringValue(item.link) ?? getStringValue(item.guid),
    publishedAt: getStringValue(item.pubDate),
    summary: getStringValue(item.description),
    categories: parseCategoryValues(item.category),
  };
}

function getAtomEntryLink(input: unknown): string | null {
  const links = asArray(input);
  const alternateLink = links.find(
    (link) => getAttributeValue(link, 'rel') === 'alternate',
  );
  const selectedLink = alternateLink ?? links[0];

  return getStringValue(selectedLink) ?? getAttributeValue(selectedLink, 'href');
}

function parseAtomEntry(entry: unknown): RssAtomParsedFeedEntry | null {
  if (!isRecord(entry)) {
    return null;
  }

  return {
    title: getStringValue(entry.title),
    sourceUrl: getAtomEntryLink(entry.link),
    publishedAt:
      getStringValue(entry.published) ?? getStringValue(entry.updated),
    summary: getStringValue(entry.summary),
    categories: parseCategoryValues(entry.category),
  };
}

// XML feed parsing
// This pure function deliberately extracts only metadata fields needed by the
// adapter. It ignores RSS/Atom content body tags so later mapping cannot persist
// complete third-party articles by accident.
export function parseRssAtomFeedEntries(xml: string): RssAtomParsedFeedEntry[] {
  const parsedFeed = rssAtomXmlParser.parse(xml) as unknown;
  const rssChannel = getRssChannel(parsedFeed);

  if (rssChannel) {
    return asArray(rssChannel.item)
      .map(parseRssEntry)
      .filter((entry): entry is RssAtomParsedFeedEntry => entry !== null);
  }

  if (isRecord(parsedFeed) && isRecord(parsedFeed.feed)) {
    return asArray(parsedFeed.feed.entry)
      .map(parseAtomEntry)
      .filter((entry): entry is RssAtomParsedFeedEntry => entry !== null);
  }

  return [];
}

const KNOWN_SIGNAL_CATEGORY_SLUGS = new Set(['security', 'release', 'trend']);

function normalizeCategoryValue(category: string): string {
  return category.trim().toLowerCase();
}

function findCandidateCategory(categories: string[]): string | null {
  return (
    categories
      .map(normalizeCategoryValue)
      .find((category) => KNOWN_SIGNAL_CATEGORY_SLUGS.has(category)) ?? null
  );
}

function findCandidateTechnologies(categories: string[]): string[] {
  const candidateCategory = findCandidateCategory(categories);

  return categories.filter(
    (category) => normalizeCategoryValue(category) !== candidateCategory,
  );
}

function buildSkippedEntryReport(
  entry: RssAtomParsedFeedEntry,
  errors: RssAtomIngestionIssue[],
): RssAtomIngestionEntryReport {
  return {
    title: entry.title ?? 'missing-title',
    sourceUrl: entry.sourceUrl ?? 'missing-source-url',
    status: 'skipped',
    warnings: [],
    errors,
  };
}

function buildSourceSkippedReport(
  source: RssAtomIngestionSource,
  errors: RssAtomIngestionIssue[],
): RssAtomIngestionEntryReport {
  return {
    title: source.name,
    sourceUrl: source.url,
    status: 'skipped',
    warnings: [],
    errors,
  };
}

// Entry mapping
// The adapter turns parsed feed metadata into the same internal contract used
// by manual ingestion. It may keep short feed summaries, but it must never carry
// raw RSS/Atom content bodies into `IngestionItem`.
export function mapRssAtomEntriesToIngestionItems(
  source: RssAtomIngestionSource,
  entries: readonly RssAtomParsedFeedEntry[],
): RssAtomIngestionAdapterResult {
  const items: IngestionItem[] = [];
  const entryReports: RssAtomIngestionEntryReport[] = [];

  for (const entry of entries) {
    if (entry.title === null) {
      entryReports.push(
        buildSkippedEntryReport(entry, [
          { code: 'entry.titleMissing', field: 'title' },
        ]),
      );

      continue;
    }

    if (entry.sourceUrl === null) {
      entryReports.push(
        buildSkippedEntryReport(entry, [
          { code: 'entry.sourceUrlMissing', field: 'sourceUrl' },
        ]),
      );

      continue;
    }

    if (!isPublicHttpUrl(entry.sourceUrl)) {
      entryReports.push(
        buildSkippedEntryReport(entry, [
          { code: 'entry.sourceUrlInvalid', field: 'sourceUrl' },
        ]),
      );

      continue;
    }

    if (
      entry.summary !== null &&
      entry.summary.length > MAX_INGESTION_SHORT_SUMMARY_LENGTH
    ) {
      entryReports.push(
        buildSkippedEntryReport(entry, [
          { code: 'entry.summaryTooLong', field: 'summary' },
        ]),
      );

      continue;
    }

    const candidateCategory = findCandidateCategory(entry.categories);
    const candidateTechnologies = findCandidateTechnologies(entry.categories);
    const warnings: RssAtomIngestionIssue[] = [];

    if (candidateCategory === null) {
      warnings.push({ code: 'entry.categoryMissing', field: 'categories' });
    }

    if (candidateTechnologies.length === 0) {
      warnings.push({ code: 'entry.technologyMissing', field: 'categories' });
    }

    const item: IngestionItem = {
      title: entry.title,
      sourceUrl: entry.sourceUrl,
      source: {
        name: source.name,
        url: source.url,
        type: source.type,
      },
      candidateCategory,
      candidateTechnologies,
      publishedAt: entry.publishedAt,
      shortSummary: entry.summary,
    };

    items.push(item);
    entryReports.push({
      title: item.title,
      sourceUrl: item.sourceUrl,
      status: 'mapped',
      warnings,
      errors: [],
    });
  }

  return {
    items,
    entries: entryReports,
  };
}

// Adapter orchestration
// This is the first executable boundary for RSS/Atom ingestion. It validates the
// allowlisted source shape, delegates network access to `fetchFeed`, then keeps
// the rest of the flow pure and testable.
export async function runRssAtomIngestionAdapter(
  source: RssAtomIngestionSource,
  dependencies: RssAtomIngestionDependencies,
): Promise<RssAtomIngestionAdapterResult> {
  if (source.status !== 'active') {
    return {
      items: [],
      entries: [
        buildSourceSkippedReport(source, [
          { code: 'source.inactive', field: 'source.status' },
        ]),
      ],
    };
  }

  if (source.type !== RSS_ATOM_SOURCE_TYPE) {
    return {
      items: [],
      entries: [
        buildSourceSkippedReport(source, [
          { code: 'source.typeUnsupported', field: 'source.type' },
        ]),
      ],
    };
  }

  let feedXml: string;

  try {
    feedXml = await dependencies.fetchFeed(source.url);
  } catch {
    return {
      items: [],
      entries: [
        buildSourceSkippedReport(source, [
          { code: 'feed.fetchFailed', field: 'fetchFeed' },
        ]),
      ],
    };
  }

  try {
    return mapRssAtomEntriesToIngestionItems(
      source,
      parseRssAtomFeedEntries(feedXml),
    );
  } catch {
    return {
      items: [],
      entries: [
        buildSourceSkippedReport(source, [
          { code: 'feed.parseFailed', field: 'feed' },
        ]),
      ],
    };
  }
}

// Pipeline bridge
// This keeps the RSS/Atom adapter focused on external feed concerns, then hands
// the resulting items to the existing validation -> normalization -> persistence
// flow. The dependency object is intentionally injectable end to end.
export async function runRssAtomIngestion(
  source: RssAtomIngestionSource,
  dependencies: RssAtomIngestionRunDependencies,
): Promise<RssAtomIngestionRunResult> {
  const adapter = await runRssAtomIngestionAdapter(source, dependencies);
  const ingestion = await runManualDemoIngestion(adapter.items, dependencies);

  return {
    adapter,
    ingestion,
  };
}
