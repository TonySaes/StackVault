import type { PublicResource } from '../../api/resources-api';
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

function getSourceTrustBadge(resource: PublicResource) {
  switch (resource.source.status) {
    case 'active':
      return {
        label: 'Source active',
        tone: 'verified' as const,
      };
    case 'inactive':
      return {
        label: 'Source inactive',
        tone: 'neutral' as const,
      };
    case 'error':
      return {
        label: 'Source en erreur',
        tone: 'danger' as const,
      };
    default:
      return {
        label: 'Source a verifier',
        tone: 'warning' as const,
      };
  }
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

export function ResourceCard({ resource }: ResourceCardProps) {
  const sourceTrustBadge = getSourceTrustBadge(resource);
  const freshnessBadge = getFreshnessBadge(resource);

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

      <div className="resource-card-content">
        <h3>{resource.title}</h3>
        <p>{resource.shortSummary ?? 'Resume indisponible pour le moment.'}</p>
      </div>

      <p className="resource-technologies">
        {formatTechnologies(resource)}
      </p>

      <a
        className="resource-source-link"
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
