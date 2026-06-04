import type {
  PublicCoverageResponse,
  PublicCoverageSource,
  PublicCoverageTechnology,
} from '../../api/coverage-api';
import './CoverageSummary.css';

interface CoverageSummaryProps {
  coverage: PublicCoverageResponse;
}

function formatSourceStatus(source: PublicCoverageSource) {
  switch (source.status) {
    case 'active':
      return 'Source active';
    case 'inactive':
      return 'Source inactive';
    case 'error':
      return 'Source en erreur';
    default:
      return 'Statut a verifier';
  }
}

function formatTechnologyStatus(technology: PublicCoverageTechnology) {
  switch (technology.status) {
    case 'active':
      return 'Suivie';
    case 'inactive':
      return 'Inactive';
    default:
      return 'A verifier';
  }
}

export function CoverageSummary({ coverage }: CoverageSummaryProps) {
  return (
    <section className="coverage-summary" aria-labelledby="coverage-title">
      <header className="coverage-summary-header">
        <p className="eyebrow">Couverture</p>
        <h1 id="coverage-title">Sources et technologies suivies</h1>
        <p>
          StackVault suit volontairement un perimetre limite pour le MVP. Cette
          page montre ce qui est couvert, sans pretendre etre exhaustive.
        </p>
      </header>

      <div className="coverage-summary-grid">
        <section aria-labelledby="coverage-technologies-title">
          <h2 id="coverage-technologies-title">Technologies suivies</h2>
          <ul className="coverage-list">
            {coverage.technologies.map((technology) => (
              <li key={technology.id}>
                <span>{technology.name}</span>
                <span>{formatTechnologyStatus(technology)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="coverage-sources-title">
          <h2 id="coverage-sources-title">Sources declarees</h2>
          <ul className="coverage-list">
            {coverage.sources.map((source) => (
              <li key={source.id}>
                <span>{source.name}</span>
                <span>{source.type}</span>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.url}
                </a>
                <span>{formatSourceStatus(source)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
