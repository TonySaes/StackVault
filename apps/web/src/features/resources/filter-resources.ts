import type { PublicResource } from '../../api/resources-api';

export interface ResourceFilters {
  searchQuery: string;
  technologySlug: string;
  categorySlug: string;
}

function matchesSearchQuery(resource: PublicResource, searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  const searchableText = `${resource.title} ${resource.shortSummary ?? ''}`.toLowerCase();

  return searchableText.includes(normalizedQuery);
}

function matchesTechnology(resource: PublicResource, technologySlug: string) {
  if (technologySlug.length === 0) {
    return true;
  }

  return resource.technologies.some(
    (technology) => technology.slug === technologySlug,
  );
}

function matchesCategory(resource: PublicResource, categorySlug: string) {
  if (categorySlug.length === 0) {
    return true;
  }

  return resource.category.slug === categorySlug;
}

export function filterResources(
  resources: PublicResource[],
  filters: ResourceFilters,
) {
  return resources.filter(
    (resource) =>
      matchesSearchQuery(resource, filters.searchQuery) &&
      matchesTechnology(resource, filters.technologySlug) &&
      matchesCategory(resource, filters.categorySlug),
  );
}
