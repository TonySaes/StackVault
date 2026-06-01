import type { PublicResource } from '../../api/resources-api';

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

export function ResourceCard({ resource }: ResourceCardProps) {
  return (
    <article>
      <div className="resource-meta">
        <span>{resource.category.name}</span>
        <span>{resource.source.name}</span>
        <time dateTime={resource.publishedAt ?? resource.detectedAt}>
          {formatResourceDate(resource)}
        </time>
      </div>
      <h3>{resource.title}</h3>
      <p>{resource.shortSummary ?? 'Resume indisponible pour le moment.'}</p>
      <p className="resource-technologies">
        {resource.technologies.map((technology) => technology.name).join(', ')}
      </p>
    </article>
  );
}
