import { useEffect, useState } from 'react';

import {
  fetchCoverage,
  type PublicCoverageResponse,
} from '../api/coverage-api';
import { CoverageSummary } from '../components/coverage/CoverageSummary';
import './PublicPage.css';

type CoveragePageState =
  | { status: 'loading' }
  | { status: 'success'; data: PublicCoverageResponse }
  | { status: 'empty' }
  | { status: 'error' };

function hasCoverageData(coverage: PublicCoverageResponse) {
  return coverage.technologies.length > 0 || coverage.sources.length > 0;
}

export function CoveragePage() {
  const [coverageState, setCoverageState] = useState<CoveragePageState>({
    status: 'loading',
  });

  // Public coverage loading
  // Empty coverage means StackVault has no declared scope yet. It is different
  // from an API failure and needs a calmer public message.
  useEffect(() => {
    let ignoreResult = false;

    async function loadCoverage() {
      try {
        const coverage = await fetchCoverage();

        if (ignoreResult) {
          return;
        }

        setCoverageState(
          hasCoverageData(coverage)
            ? { status: 'success', data: coverage }
            : { status: 'empty' },
        );
      } catch {
        if (!ignoreResult) {
          setCoverageState({ status: 'error' });
        }
      }
    }

    setCoverageState({ status: 'loading' });
    void loadCoverage();

    return () => {
      ignoreResult = true;
    };
  }, []);

  if (coverageState.status === 'loading') {
    return (
      <main className="app-shell" aria-labelledby="coverage-title">
        <section className="placeholder-panel">
          <p className="eyebrow">Couverture</p>
          <h1 id="coverage-title">Chargement de la couverture</h1>
          <p>Les sources et technologies suivies sont en cours de chargement.</p>
        </section>
      </main>
    );
  }

  if (coverageState.status === 'empty') {
    return (
      <main className="app-shell" aria-labelledby="coverage-title">
        <section className="placeholder-panel">
          <p className="eyebrow">Couverture</p>
          <h1 id="coverage-title">Couverture non declaree</h1>
          <p>
            Aucune source ou technologie n'est encore declaree publiquement. Cela
            indique une couverture vide, pas une panne technique.
          </p>
          <p>
            <a className="public-page-back-link" href="/">
              Revenir au dashboard
            </a>
          </p>
        </section>
      </main>
    );
  }

  if (coverageState.status === 'error') {
    return (
      <main className="app-shell" aria-labelledby="coverage-title">
        <section className="placeholder-panel">
          <p className="eyebrow">Couverture</p>
          <h1 id="coverage-title">Couverture temporairement indisponible</h1>
          <p>
            Les donnees de couverture n'ont pas pu etre chargees. La consultation
            pourra reprendre quand le service sera disponible.
          </p>
          <p>
            <a className="public-page-back-link" href="/">
              Revenir au dashboard
            </a>
          </p>
        </section>
      </main>
    );
  }

  const coverage = coverageState.data;

  return (
    <main className="app-shell" aria-labelledby="coverage-title">
      <p>
        <a className="public-page-back-link" href="/">
          Revenir au dashboard
        </a>
      </p>
      <CoverageSummary coverage={coverage} />
    </main>
  );
}
