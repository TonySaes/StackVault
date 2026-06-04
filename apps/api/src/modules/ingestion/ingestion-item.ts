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

// Forbidden third-party body fields
// These keys are blocked because StackVault may keep metadata and summaries,
// but must not persist complete third-party content bodies.
export const FORBIDDEN_INGESTION_BODY_FIELDS = [
  'body',
  'rawContent',
  'html',
  'fullText',
] as const;

export type ForbiddenIngestionBodyField =
  (typeof FORBIDDEN_INGESTION_BODY_FIELDS)[number];

// Validation result shape
// Runtime validation will use these small codes so errors stay actionable
// without exposing source payloads, stack traces or provider internals.
export type IngestionItemErrorCode =
  | 'title.required'
  | 'sourceUrl.required'
  | 'sourceUrl.invalid'
  | 'source.required'
  | 'candidateTechnologies.invalid'
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

function isValidUrl(input: string): boolean {
  try {
    new URL(input);

    return true;
  } catch {
    return false;
  }
}

function isValidSourceReference(input: unknown): input is IngestionSourceReference {
  return (
    isRecord(input) &&
    isNonEmptyString(input.name) &&
    isNonEmptyString(input.url) &&
    isNonEmptyString(input.type)
  );
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

  for (const field of FORBIDDEN_INGESTION_BODY_FIELDS) {
    if (field in input) {
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
  } else if (!isValidUrl(input.sourceUrl)) {
    errors.push({ code: 'sourceUrl.invalid', field: 'sourceUrl' });
  }

  if (!isValidSourceReference(input.source)) {
    errors.push({ code: 'source.required', field: 'source' });
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

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  const item: IngestionItem = {
    title: input.title as string,
    sourceUrl: input.sourceUrl as string,
    source: input.source as IngestionSourceReference,
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
