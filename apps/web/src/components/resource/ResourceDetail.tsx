import type { PublicResource } from '../../api/resources-api';
import './ResourceDetail.css';

interface ResourceDetailProps {
  resource: PublicResource;
}

function formatResourceDate(resource: PublicResource) {
  const dateValue = resource.publishedAt ?? resource.detectedAt;

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateValue));
}

function formatTechnologies(resource: PublicResource) {
  if (resource.technologies.length === 0) {
    return 'Technologie non precisee';
  }

  return resource.technologies.map((technology) => technology.name).join(', ');
}

function formatLinkStatus(linkStatus: string) {
  switch (linkStatus) {
    case 'active':
      return 'Lien actif';
    case 'unavailable':
      return 'Lien indisponible';
    case 'redirect':
      return 'Redirection';
    case 'unknown':
      return 'Lien non verifie';
    default:
      return 'Lien a verifier';
  }
}

export function ResourceDetail({ resource }: ResourceDetailProps) {
  return (
    <article className="resource-detail">
      <header className="resource-detail-header">
        <p className="eyebrow">Fiche ressource</p>
        <h1 id="resource-detail-title">{resource.title}</h1>
        <p className="lede">
          {resource.shortSummary ?? 'Resume indisponible pour le moment.'}
        </p>
      </header>

      <dl className="resource-detail-metadata">
        <div>
          <dt>Source</dt>
          <dd>{resource.source.name}</dd>
        </div>
        <div>
          <dt>URL source</dt>
          <dd>{resource.sourceUrl}</dd>
        </div>
        <div>
          <dt>Categorie</dt>
          <dd>{resource.category.name}</dd>
        </div>
        <div>
          <dt>Technologies</dt>
          <dd>{formatTechnologies(resource)}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatResourceDate(resource)}</dd>
        </div>
        <div>
          <dt>Statut du lien</dt>
          <dd>{formatLinkStatus(resource.linkStatus)}</dd>
        </div>
      </dl>

      <p className="resource-detail-source-note">
        StackVault aide a reperer et contextualiser cette ressource. La source
        officielle reste la reference a consulter avant toute decision.
      </p>

      <a
        className="resource-detail-source-link"
        href={resource.sourceUrl}
        aria-label={`Lire la source officielle de ${resource.title}`}
        target="_blank"
        rel="noreferrer"
      >
        Lire la source officielle
      </a>
    </article>
  );
}
