import { useEffect, useMemo, useState } from 'react';

import {
  ResourceFilterBar,
  type ResourceFilterOption,
} from '../components/resource/ResourceFilterBar';
import { ResourceSignalSection } from '../components/resource/ResourceSignalSection';
import {
  fetchResources,
  type PaginatedResourcesResponse,
} from '../api/resources-api';
import {
  filterResources,
  type ResourceFilters,
} from '../features/resources/filter-resources';
import { groupResourcesBySignal } from '../features/resources/group-resources-by-signal';

// Resource feed state machine
// One status owns the valid shape of the data. For example, data only exists
// when status is "success", which avoids inconsistent loading/error/data states.
type ResourceFeedState =
  | { status: 'loading' }
  | { status: 'success'; data: PaginatedResourcesResponse }
  | { status: 'empty' }
  | { status: 'error' };

// Dashboard signal sections
// The order is intentional: security first, then releases, then trends. It keeps
// high-impact alerts visible before broader watch signals.
const signalSections = [
  {
    key: 'security',
    title: 'Securite',
    description: 'Alertes, correctifs et signaux qui peuvent demander une action rapide.',
    emptyMessage: 'Aucun signal securite disponible pour le moment.',
  },
  {
    key: 'release',
    title: 'Releases',
    description: 'Nouvelles versions, changelogs et evolutions a suivre.',
    emptyMessage: 'Aucune release disponible pour le moment.',
  },
  {
    key: 'trend',
    title: 'Tendances',
    description: "Signaux faibles, outils et pratiques qui montent dans l'ecosysteme.",
    emptyMessage: 'Aucune tendance disponible pour le moment.',
  },
] as const;

const initialResourceFilters: ResourceFilters = {
  searchQuery: '',
  technologySlug: '',
  categorySlug: '',
};

function sortFilterOptions(options: ResourceFilterOption[]) {
  return [...options].sort((firstOption, secondOption) =>
    firstOption.label.localeCompare(secondOption.label, 'fr'),
  );
}

function buildTechnologyOptions(resources: PaginatedResourcesResponse['items']) {
  const optionsBySlug = new Map<string, ResourceFilterOption>();

  for (const resource of resources) {
    for (const technology of resource.technologies) {
      optionsBySlug.set(technology.slug, {
        label: technology.name,
        value: technology.slug,
      });
    }
  }

  return sortFilterOptions([...optionsBySlug.values()]);
}

function buildCategoryOptions(resources: PaginatedResourcesResponse['items']) {
  const optionsBySlug = new Map<string, ResourceFilterOption>();

  for (const resource of resources) {
    optionsBySlug.set(resource.category.slug, {
      label: resource.category.name,
      value: resource.category.slug,
    });
  }

  return sortFilterOptions([...optionsBySlug.values()]);
}

export function DashboardRoute() {
  const [resourceFeed, setResourceFeed] = useState<ResourceFeedState>({
    status: 'loading',
  });
  const [resourceFilters, setResourceFilters] = useState<ResourceFilters>(
    initialResourceFilters,
  );
  const filteredResources = useMemo(
    () =>
      resourceFeed.status === 'success'
        ? filterResources(resourceFeed.data.items, resourceFilters)
        : [],
    [resourceFeed, resourceFilters],
  );
  const groupedResources =
    resourceFeed.status === 'success'
      ? groupResourcesBySignal(filteredResources)
      : null;

  // Filter options are derived from the complete feed, not from filtered results.
  // This keeps the selects stable while the visitor combines several criteria.
  const technologyOptions = useMemo(
    () =>
      resourceFeed.status === 'success'
        ? buildTechnologyOptions(resourceFeed.data.items)
        : [],
    [resourceFeed],
  );
  const categoryOptions = useMemo(
    () =>
      resourceFeed.status === 'success'
        ? buildCategoryOptions(resourceFeed.data.items)
        : [],
    [resourceFeed],
  );
  const hasActiveFilters =
    resourceFilters.searchQuery.trim().length > 0 ||
    resourceFilters.technologySlug.length > 0 ||
    resourceFilters.categorySlug.length > 0;
  const hasFilteredResources = filteredResources.length > 0;

  // Controlled filter updates
  // Each callback updates one field while keeping the other filters intact.
  function updateSearchQuery(searchQuery: string) {
    setResourceFilters((currentFilters) => ({
      ...currentFilters,
      searchQuery,
    }));
  }

  function updateTechnologyFilter(technologySlug: string) {
    setResourceFilters((currentFilters) => ({
      ...currentFilters,
      technologySlug,
    }));
  }

  function updateCategoryFilter(categorySlug: string) {
    setResourceFilters((currentFilters) => ({
      ...currentFilters,
      categorySlug,
    }));
  }

  // Initial resource loading
  // ignoreResult prevents an outdated network response from updating state after
  // React has unmounted this route.
  useEffect(() => {
    let ignoreResult = false;

    async function loadResources() {
      try {
        const resources = await fetchResources();

        if (ignoreResult) {
          return;
        }

        setResourceFeed(
          resources.items.length > 0
            ? { status: 'success', data: resources }
            : { status: 'empty' },
        );
      } catch {
        if (!ignoreResult) {
          setResourceFeed({ status: 'error' });
        }
      }
    }

    void loadResources();

    return () => {
      ignoreResult = true;
    };
  }, []);

  return (
    <main className="app-shell" aria-labelledby="dashboard-title">
      <section className="hero-section">
        <p className="eyebrow">Veille developpeur verifiable</p>
        <h1 id="dashboard-title">StackVault</h1>
        <p className="lede">
          Un dashboard public minimal est pret. Les releases, signaux de securite
          et tendances seront ajoutes par increments dedies.
        </p>
      </section>

      <section className="placeholder-panel" aria-labelledby="next-signals-title">
        <h2 id="next-signals-title">Flux de ressources</h2>

        {/* Resource feed states */}
        {resourceFeed.status === 'loading' ? (
          <p>Chargement des ressources de veille...</p>
        ) : null}

        {resourceFeed.status === 'error' ? (
          <p>
            Le flux de ressources est temporairement indisponible. La consultation
            pourra reprendre quand le service sera disponible.
          </p>
        ) : null}

        {resourceFeed.status === 'empty' ? (
          <p>
            Aucune ressource n'est disponible pour le moment. Le dashboard est pret
            a afficher les prochains signaux de veille.
          </p>
        ) : null}

        {resourceFeed.status === 'success' ? (
          <div className="resource-section-list">
            <ResourceFilterBar
              filters={resourceFilters}
              technologyOptions={technologyOptions}
              categoryOptions={categoryOptions}
              hasActiveFilters={hasActiveFilters}
              onSearchQueryChange={updateSearchQuery}
              onTechnologyChange={updateTechnologyFilter}
              onCategoryChange={updateCategoryFilter}
              onResetFilters={() => setResourceFilters(initialResourceFilters)}
            />

            {hasFilteredResources ? (
              <>
                {signalSections.map((section) => (
                  <ResourceSignalSection
                    key={section.key}
                    title={section.title}
                    description={section.description}
                    emptyMessage={section.emptyMessage}
                    resources={groupedResources?.[section.key] ?? []}
                  />
                ))}
                {groupedResources && groupedResources.other.length > 0 ? (
                  <ResourceSignalSection
                    title="Autres signaux"
                    description="Ressources classees avec un type de signal non encore standardise."
                    emptyMessage="Aucun autre signal disponible pour le moment."
                    resources={groupedResources.other}
                  />
                ) : null}
              </>
            ) : (
              <p className="resource-filter-empty">
                Aucune ressource ne correspond aux criteres actuels. Modifiez ou
                reinitialisez les filtres pour retrouver le flux complet.
              </p>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
