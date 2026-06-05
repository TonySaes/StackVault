// Normalization context
// The normalizer receives resolved catalog entries instead of reading the DB.
// Later services or jobs will own the Prisma queries and pass this context in.
export interface IngestionNormalizationSource {
  id: string;
  name: string;
  url: string;
  status: string;
}

export interface IngestionNormalizationCategory {
  id: string;
  slug: string;
  name: string;
}

export interface IngestionNormalizationTechnology {
  id: string;
  slug: string;
  name: string;
  status: string;
}

export interface IngestionNormalizationContext {
  sources: IngestionNormalizationSource[];
  categories: IngestionNormalizationCategory[];
  technologies: IngestionNormalizationTechnology[];
  fallbackCategorySlug: string;
}

// Public resource draft
// This shape mirrors the fields needed by Prisma `Resource` creation without
// importing Prisma or writing to the database in this story.
export interface NormalizedResourceDraft {
  sourceId: string;
  categoryId: string;
  title: string;
  sourceUrl: string;
  canonicalUrl: string;
  publishedAt: Date | null;
  shortSummary: string | null;
  lifecycleStatus: 'active';
  linkStatus: 'unknown';
  technologyIds: string[];
}

// Normalization feedback
// Errors block publication. Warnings document safe fallbacks so the caller can
// inspect quality without exposing third-party payload content.
export type IngestionNormalizationErrorCode =
  | 'source.notAllowlisted'
  | 'source.inactive'
  | 'categoryFallback.missing'
  | 'publishedAt.invalid';

export type IngestionNormalizationWarningCode =
  | 'category.fallback'
  | 'technology.unmatched';

export interface IngestionNormalizationIssue {
  code: IngestionNormalizationErrorCode | IngestionNormalizationWarningCode;
  field: string;
}

export type IngestionNormalizationResult =
  | {
      success: true;
      draft: NormalizedResourceDraft;
      warnings: IngestionNormalizationIssue[];
    }
  | {
      success: false;
      errors: IngestionNormalizationIssue[];
    };
