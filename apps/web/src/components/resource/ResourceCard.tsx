import type { PublicResource } from '../../api/resources-api';
import { getSourceStatusPresentation } from '../../features/sources/source-status';
import { ResourceTrustBadge } from './ResourceTrustBadge';
import './ResourceCard.css';

interface ResourceCardProps {
  resource: PublicResource;
}

// Display helpers
// API dates arrive as ISO strings. Formatting stays at the component boundary
// because ResourceCard is responsible for presentation, not for HTTP transport.
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

function buildResourceDetailPath(resource: PublicResource) {
  return `/resources/${encodeURIComponent(resource.id)}`;
}

function getSourceTrustBadge(resource: PublicResource) {
  return getSourceStatusPresentation(resource.source.status);
}

function getFreshnessBadge(resource: PublicResource) {
  const dateValue = resource.publishedAt ?? resource.detectedAt;
  const ageInDays = Math.floor(
    (Date.now() - new Date(dateValue).getTime()) / (1000 * 60 * 60 * 24),
  );

  if (ageInDays <= 14) {
    return {
      label: 'Recent',
      tone: 'info' as const,
    };
  }

  if (ageInDays <= 60) {
    return {
      label: 'A surveiller',
      tone: 'warning' as const,
    };
  }

  return {
    label: 'Archive',
    tone: 'neutral' as const,
  };
}

function getLinkStatusBadge(resource: PublicResource) {
  switch (resource.linkStatus) {
    case 'active':
      return {
        label: 'Lien actif',
        tone: 'verified' as const,
      };
    case 'unavailable':
      return {
        label: 'Lien indisponible',
        tone: 'danger' as const,
      };
    case 'redirect':
      return {
        label: 'Redirection',
        tone: 'warning' as const,
      };
    case 'unknown':
      return {
        label: 'Lien non verifie',
        tone: 'neutral' as const,
      };
    case 'to_verify':
      return {
        label: 'Lien a verifier',
        tone: 'warning' as const,
      };
    default:
      return {
        label: 'Lien a verifier',
        tone: 'warning' as const,
      };
  }
}

export function ResourceCard({ resource }: ResourceCardProps) {
  const sourceTrustBadge = getSourceTrustBadge(resource);
  const freshnessBadge = getFreshnessBadge(resource);
  const linkStatusBadge = getLinkStatusBadge(resource);
  const resourceDetailPath = buildResourceDetailPath(resource);

  return (
    <article className="resource-card">
      <div className="resource-meta">
        <span aria-label={`Categorie: ${resource.category.name}`}>
          {resource.category.name}
        </span>
        <span aria-label={`Source: ${resource.source.name}`}>
          {resource.source.name}
        </span>
        <time
          aria-label={`Date: ${formatResourceDate(resource)}`}
          dateTime={resource.publishedAt ?? resource.detectedAt}
        >
          {formatResourceDate(resource)}
        </time>
      </div>

      <div className="resource-trust-list" aria-label="Indicateurs de confiance">
        <ResourceTrustBadge
          label={sourceTrustBadge.label}
          tone={sourceTrustBadge.tone}
          accessibleLabel={`${sourceTrustBadge.label}: ${resource.source.name}`}
        />
        <ResourceTrustBadge
          label={freshnessBadge.label}
          tone={freshnessBadge.tone}
          accessibleLabel={`Fraicheur: ${freshnessBadge.label}`}
        />
        <ResourceTrustBadge
          label={linkStatusBadge.label}
          tone={linkStatusBadge.tone}
          accessibleLabel={`Statut du lien: ${linkStatusBadge.label}`}
        />
      </div>

      <div className="resource-card-content">
        <h3>{resource.title}</h3>
        <p>{resource.shortSummary ?? 'Resume indisponible pour le moment.'}</p>
      </div>

      <p className="resource-technologies">
        {formatTechnologies(resource)}
      </p>

      <div className="resource-actions">
        <a
          className="resource-detail-link"
          href={resourceDetailPath}
          aria-label={`Ouvrir la fiche detaillee de ${resource.title}`}
        >
          Ouvrir la fiche
        </a>
        <a
          className="resource-source-link"
          href={resource.sourceUrl}
          aria-label={`Lire la source officielle de ${resource.title}, ouvre un nouvel onglet`}
          target="_blank"
          rel="noreferrer"
        >
          <span className="resource-source-link-label">
            Lire la source officielle
          </span>
          <span className="resource-source-link-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M14 4h6v6" />
              <path d="M10 14 20 4" />
              <path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
            </svg>
          </span>
        </a>
      </div>
    </article>
  );
}
