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

type HtmlAttributeMap = Record<string, string>;

const HTML_TEXT_ENTITY_VALUES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

const PUBLICATION_DATE_META_KEYS = [
  'article:published_time',
  'date',
  'datepublished',
  'pubdate',
];

function getNonEmptyString(input: string | null): string | null {
  return input !== null && input.trim().length > 0 ? input.trim() : null;
}

function decodeBasicHtmlEntities(input: string): string {
  return input.replace(
    /&(#\d+|#x[\da-f]+|amp|apos|gt|lt|nbsp|quot);/gi,
    (entity, value: string) => {
      const normalizedValue = value.toLowerCase();

      if (normalizedValue.startsWith('#x')) {
        return String.fromCodePoint(Number.parseInt(normalizedValue.slice(2), 16));
      }

      if (normalizedValue.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(normalizedValue.slice(1), 10));
      }

      return HTML_TEXT_ENTITY_VALUES[normalizedValue] ?? entity;
    },
  );
}

function sanitizeMetadataText(input: string | null): string | null {
  if (input === null) {
    return null;
  }

  const plainText = decodeBasicHtmlEntities(input)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .trim();

  return plainText.length > 0 ? plainText : null;
}

function parseHtmlAttributes(tag: string): HtmlAttributeMap {
  const attributes: HtmlAttributeMap = {};
  const attributePattern = /([^\s"'=<>`]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(tag)) !== null) {
    const [, name, doubleQuotedValue, singleQuotedValue, unquotedValue] = match;

    if (name) {
      attributes[name.toLowerCase()] =
        doubleQuotedValue ?? singleQuotedValue ?? unquotedValue ?? '';
    }
  }

  return attributes;
}

function getMetadataKey(attributes: HtmlAttributeMap): string | null {
  const metadataKey =
    attributes.property ??
    attributes.name ??
    attributes.itemprop ??
    null;

  return metadataKey === null ? null : metadataKey.toLowerCase();
}

function getMetaContentByKey(html: string, keys: readonly string[]): string | null {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  const metaTagPattern = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = metaTagPattern.exec(html)) !== null) {
    const [tag] = match;
    const attributes = parseHtmlAttributes(tag);
    const metadataKey = getMetadataKey(attributes);

    if (metadataKey !== null && normalizedKeys.has(metadataKey)) {
      return getNonEmptyString(attributes.content ?? null);
    }
  }

  return null;
}

function getTitleTagContent(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);

  return match ? getNonEmptyString(match[1] ?? null) : null;
}

// Public metadata parsing
// This parser is intentionally narrow: it reads only page-level metadata tags
// and never returns the raw HTML document or article body.
export function parsePublicMetadataPage(
  html: string,
  sourceUrl: string,
): PublicMetadataParsedPage {
  const title =
    sanitizeMetadataText(getMetaContentByKey(html, ['og:title'])) ??
    sanitizeMetadataText(getTitleTagContent(html));
  const summary = sanitizeMetadataText(
    getMetaContentByKey(html, ['og:description', 'description']),
  );
  const publishedAt = getMetaContentByKey(html, PUBLICATION_DATE_META_KEYS);

  return {
    title,
    sourceUrl,
    publishedAt,
    summary,
  };
}
