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
// These keys are blocked because wannna keep metadata and summaries, but
// must not persist complete third-party content bodies.
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
