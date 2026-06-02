import type { PublicResource } from '../../api/resources-api';
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

export function ResourceCard({ resource }: ResourceCardProps) {
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
