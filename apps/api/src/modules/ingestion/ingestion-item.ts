// Ingestion contract
// An ingestion item is a candidate resource before StackVault normalizes it into
// the public Resource model. It carries metadata only, never the full source body.
export interface IngestionItem {
  title: string;
  sourceUrl: string;
  source: IngestionSourceReference;
  candidateCategory: string | null;
  candidateTechnologies: string[];
  publishedAt?: Date | string | null;
  shortSummary?: string | null;
}

export interface IngestionSourceReference {
  name: string;
  url: string;
  type: string;
}

export const MAX_INGESTION_SHORT_SUMMARY_LENGTH = 500;

// Forbidden third-party body fields
// These keys are blocked because StackVault may keep metadata and summaries,
// but must not persist complete third-party content bodies.
export const FORBIDDEN_INGESTION_BODY_FIELDS = [
  'body',
  'rawContent',
  'html',
  'fullText',
  'content',
  'articleBody',
  'bodyHtml',
  'rawHtml',
  'markdown',
] as const;

export type ForbiddenIngestionBodyField =
  (typeof FORBIDDEN_INGESTION_BODY_FIELDS)[number];

const FORBIDDEN_INGESTION_BODY_FIELD_KEYS = new Set(
  FORBIDDEN_INGESTION_BODY_FIELDS.map((field) => field.toLowerCase()),
);

// Validation result shape
// Runtime validation will use these small codes so errors stay actionable
// without exposing source payloads, stack traces or provider internals.
export type IngestionItemErrorCode =
  | 'title.required'
  | 'sourceUrl.required'
  | 'sourceUrl.invalid'
  | 'source.required'
  | 'source.url.invalid'
  | 'candidateTechnologies.invalid'
  | 'publishedAt.invalid'
  | 'shortSummary.tooLong'
  | 'thirdPartyBody.forbidden';

export interface IngestionItemValidationError {
  code: IngestionItemErrorCode;
  field: string;
}

export type IngestionItemValidationResult =
  | {
      success: true;
      item: IngestionItem;
    }
  | {
      success: false;
      errors: IngestionItemValidationError[];
    };

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === 'string' && input.trim().length > 0;
}

function isPublicHttpUrl(input: string): boolean {
  try {
    const url = new URL(input);

    // `new URL()` accepts schemes such as `javascript:` or `data:`.
    // Public resource links must stay navigable web URLs only.
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasSourceReferenceShape(
  input: unknown,
): input is IngestionSourceReference {
  return (
    isRecord(input) &&
    isNonEmptyString(input.name) &&
    isNonEmptyString(input.url) &&
    isNonEmptyString(input.type)
  );
}

function isValidPublishedAt(input: unknown): boolean {
  if (input === null || input === undefined) {
    return true;
  }

  if (input instanceof Date) {
    return !Number.isNaN(input.getTime());
  }

  return typeof input === 'string' && !Number.isNaN(Date.parse(input));
}

function hasForbiddenBodyField(field: string): boolean {
  return FORBIDDEN_INGESTION_BODY_FIELD_KEYS.has(field.toLowerCase());
}

// Runtime validation
// External adapters will produce unknown data. This function narrows it into
// the internal contract before later stories normalize or persist anything.
export function validateIngestionItem(
  input: unknown,
): IngestionItemValidationResult {
  const errors: IngestionItemValidationError[] = [];

  if (!isRecord(input)) {
    return {
      success: false,
      errors: [
        { code: 'title.required', field: 'title' },
        { code: 'sourceUrl.required', field: 'sourceUrl' },
        { code: 'source.required', field: 'source' },
        {
          code: 'candidateTechnologies.invalid',
          field: 'candidateTechnologies',
        },
      ],
    };
  }

  for (const field of Object.keys(input)) {
    if (hasForbiddenBodyField(field)) {
      errors.push({
        code: 'thirdPartyBody.forbidden',
        field,
      });
    }
  }

  if (!isNonEmptyString(input.title)) {
    errors.push({ code: 'title.required', field: 'title' });
  }

  if (!isNonEmptyString(input.sourceUrl)) {
    errors.push({ code: 'sourceUrl.required', field: 'sourceUrl' });
  } else if (!isPublicHttpUrl(input.sourceUrl)) {
    errors.push({ code: 'sourceUrl.invalid', field: 'sourceUrl' });
  }

  if (!hasSourceReferenceShape(input.source)) {
    errors.push({ code: 'source.required', field: 'source' });
  } else if (!isPublicHttpUrl(input.source.url)) {
    errors.push({ code: 'source.url.invalid', field: 'source.url' });
  }

  if (
    !Array.isArray(input.candidateTechnologies) ||
    !input.candidateTechnologies.every((technology) =>
      isNonEmptyString(technology),
    )
  ) {
    errors.push({
      code: 'candidateTechnologies.invalid',
      field: 'candidateTechnologies',
    });
  }

  if (!isValidPublishedAt(input.publishedAt)) {
    errors.push({ code: 'publishedAt.invalid', field: 'publishedAt' });
  }

  if (
    typeof input.shortSummary === 'string' &&
    input.shortSummary.length > MAX_INGESTION_SHORT_SUMMARY_LENGTH
  ) {
    errors.push({ code: 'shortSummary.tooLong', field: 'shortSummary' });
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  const source = input.source as IngestionSourceReference;

  const item: IngestionItem = {
    title: input.title as string,
    sourceUrl: input.sourceUrl as string,
    source: {
      name: source.name,
      url: source.url,
      type: source.type,
    },
    candidateCategory: isNonEmptyString(input.candidateCategory)
      ? input.candidateCategory
      : null,
    candidateTechnologies: input.candidateTechnologies as string[],
  };

  if (
    input.publishedAt instanceof Date ||
    typeof input.publishedAt === 'string' ||
    input.publishedAt === null
  ) {
    item.publishedAt = input.publishedAt;
  }

  if (typeof input.shortSummary === 'string' || input.shortSummary === null) {
    item.shortSummary = input.shortSummary;
  }

  return {
    success: true,
    item,
  };
}
