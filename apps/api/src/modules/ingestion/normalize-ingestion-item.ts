import type { IngestionItem } from './ingestion-item.js';
import { normalizeCanonicalUrl } from '../resources/canonical-url.js';

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

function normalizeLookupValue(value: string): string {
  return value.trim().toLowerCase();
}

function parsePublishedAt(publishedAt: IngestionItem['publishedAt']): Date | null {
  if (publishedAt === undefined || publishedAt === null) {
    return null;
  }

  if (publishedAt instanceof Date) {
    return publishedAt;
  }

  return new Date(publishedAt);
}

// Normalization mapper
// The function transforms a validated ingestion item into the shape a future
// service can persist. It deliberately stays pure: no Prisma, no network, no job.
export function normalizeIngestionItem(
  item: IngestionItem,
  context: IngestionNormalizationContext,
): IngestionNormalizationResult {
  const source = context.sources.find(
    (candidateSource) => candidateSource.url === item.source.url,
  );

  if (!source) {
    return {
      success: false,
      errors: [{ code: 'source.notAllowlisted', field: 'source' }],
    };
  }

  if (source.status !== 'active') {
    return {
      success: false,
      errors: [{ code: 'source.inactive', field: 'source' }],
    };
  }

  const warnings: IngestionNormalizationIssue[] = [];
  const fallbackCategory = context.categories.find(
    (category) => category.slug === context.fallbackCategorySlug,
  );

  if (!fallbackCategory) {
    return {
      success: false,
      errors: [
        { code: 'categoryFallback.missing', field: 'fallbackCategorySlug' },
      ],
    };
  }

  const category =
    context.categories.find(
      (candidateCategory) =>
        item.candidateCategory !== null &&
        candidateCategory.slug === item.candidateCategory,
    ) ?? fallbackCategory;

  if (category === fallbackCategory && item.candidateCategory !== null) {
    warnings.push({
      code: 'category.fallback',
      field: 'candidateCategory',
    });
  }

  const technologiesBySlugOrName = new Map<string, string>();

  for (const technology of context.technologies) {
    if (technology.status === 'active') {
      technologiesBySlugOrName.set(
        normalizeLookupValue(technology.slug),
        technology.id,
      );
      technologiesBySlugOrName.set(
        normalizeLookupValue(technology.name),
        technology.id,
      );
    }
  }

  let hasUnmatchedTechnology = false;

  const technologyIds = item.candidateTechnologies.flatMap((technology) => {
    const technologyId = technologiesBySlugOrName.get(
      normalizeLookupValue(technology),
    );

    if (!technologyId) {
      hasUnmatchedTechnology = true;

      return [];
    }

    return [technologyId];
  });

  if (hasUnmatchedTechnology) {
    warnings.push({
      code: 'technology.unmatched',
      field: 'candidateTechnologies',
    });
  }

  return {
    success: true,
    draft: {
      sourceId: source.id,
      categoryId: category.id,
      title: item.title,
      sourceUrl: item.sourceUrl,
      canonicalUrl: normalizeCanonicalUrl(item.sourceUrl),
      publishedAt: parsePublishedAt(item.publishedAt),
      shortSummary: item.shortSummary ?? null,
      lifecycleStatus: 'active',
      linkStatus: 'unknown',
      technologyIds,
    },
    warnings,
  };
}
