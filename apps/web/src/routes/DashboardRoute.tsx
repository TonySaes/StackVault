import { useEffect, useState } from 'react';

import { ResourceSignalSection } from '../components/resource/ResourceSignalSection';
import {
  fetchResources,
  type PaginatedResourcesResponse,
} from '../api/resources-api';
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

export function DashboardRoute() {
  const [resourceFeed, setResourceFeed] = useState<ResourceFeedState>({
    status: 'loading',
  });
  const groupedResources =
    resourceFeed.status === 'success'
      ? groupResourcesBySignal(resourceFeed.data.items)
      : null;

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
            {signalSections.map((section) => (
              <ResourceSignalSection
                key={section.key}
                title={section.title}
                description={section.description}
                emptyMessage={section.emptyMessage}
                resources={groupedResources?.[section.key] ?? []}
              />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
