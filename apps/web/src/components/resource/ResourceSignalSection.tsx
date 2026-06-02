import type { PublicResource } from '../../api/resources-api';
import { ResourceCard } from './ResourceCard';
import './ResourceSignalSection.css';

interface ResourceSignalSectionProps {
  title: string;
  description: string;
  emptyMessage: string;
  resources: PublicResource[];
}

export function ResourceSignalSection({
  title,
  description,
  emptyMessage,
  resources,
}: ResourceSignalSectionProps) {
  const titleId = `resource-signal-${title.toLowerCase().replaceAll(' ', '-')}`;

  return (
    <section className="resource-signal-section" aria-labelledby={titleId}>
      <div className="resource-signal-heading">
        <h3 id={titleId}>{title}</h3>
        <p>{description}</p>
      </div>

      {resources.length > 0 ? (
        <ul className="resource-signal-list">
          {resources.map((resource) => (
            <li key={resource.id}>
              <ResourceCard resource={resource} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="resource-signal-empty">{emptyMessage}</p>
      )}
    </section>
  );
}
