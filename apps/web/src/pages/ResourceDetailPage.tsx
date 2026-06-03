import { useEffect, useState } from 'react';

import {
  fetchResource,
  ResourceNotFoundError,
  type PublicResource,
} from '../api/resources-api';

interface ResourceDetailPageProps {
  resourceId: string;
}

type ResourceDetailState =
  | { status: 'loading' }
  | { status: 'success'; data: PublicResource }
  | { status: 'not-found' }
  | { status: 'error' };

export function ResourceDetailPage({ resourceId }: ResourceDetailPageProps) {
  const [resourceDetail, setResourceDetail] = useState<ResourceDetailState>({
    status: 'loading',
  });

  // Resource detail loading
  // A 404 is treated separately from generic API failures so the page can later
  // render a clear "introuvable" state instead of a vague technical error.
  useEffect(() => {
    let ignoreResult = false;

    async function loadResource() {
      try {
        const resource = await fetchResource(resourceId);

        if (!ignoreResult) {
          setResourceDetail({ status: 'success', data: resource });
        }
      } catch (error) {
        if (ignoreResult) {
          return;
        }

        setResourceDetail(
          error instanceof ResourceNotFoundError
            ? { status: 'not-found' }
            : { status: 'error' },
        );
      }
    }

    setResourceDetail({ status: 'loading' });
    void loadResource();

    return () => {
      ignoreResult = true;
    };
  }, [resourceId]);

  if (resourceDetail.status === 'loading') {
    return (
      <main className="app-shell" aria-labelledby="resource-detail-title">
        <section className="placeholder-panel">
          <p className="eyebrow">Fiche ressource</p>
          <h1 id="resource-detail-title">Chargement de la ressource</h1>
          <p>La fiche publique est en cours de chargement.</p>
        </section>
      </main>
    );
  }

  if (resourceDetail.status === 'not-found') {
    return (
      <main className="app-shell" aria-labelledby="resource-detail-title">
        <section className="placeholder-panel">
          <p className="eyebrow">Fiche ressource</p>
          <h1 id="resource-detail-title">Ressource introuvable</h1>
          <p>
            Cette ressource n'existe pas ou n'est plus disponible publiquement.
          </p>
          <p>
            <a className="resource-source-link" href="/">
              Revenir au dashboard
            </a>
          </p>
        </section>
      </main>
    );
  }

  if (resourceDetail.status === 'error') {
    return (
      <main className="app-shell" aria-labelledby="resource-detail-title">
        <section className="placeholder-panel">
          <p className="eyebrow">Fiche ressource</p>
          <h1 id="resource-detail-title">Fiche temporairement indisponible</h1>
          <p>
            La ressource n'a pas pu etre chargee. La consultation pourra
            reprendre quand le service sera disponible.
          </p>
          <p>
            <a className="resource-source-link" href="/">
              Revenir au dashboard
            </a>
          </p>
        </section>
      </main>
    );
  }

  const resource = resourceDetail.data;

  return (
    <main className="app-shell" aria-labelledby="resource-detail-title">
      <article className="placeholder-panel">
        <p className="eyebrow">Fiche ressource</p>
        <h1 id="resource-detail-title">{resource.title}</h1>
        <p className="lede">
          {resource.shortSummary ?? 'Resume indisponible pour le moment.'}
        </p>
        <p>Source : {resource.source.name}</p>
        <p>Categorie : {resource.category.name}</p>
        <p>
          <a
            className="resource-source-link"
            href={resource.sourceUrl}
            aria-label={`Lire la source officielle de ${resource.title}`}
            target="_blank"
            rel="noreferrer"
          >
            Lire la source officielle
          </a>
        </p>
      </article>
    </main>
  );
}
