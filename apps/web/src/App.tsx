import { DashboardRoute } from './routes/DashboardRoute';
import { CoveragePage } from './pages/CoveragePage';
import { matchCoverageRoute } from './routes/match-coverage-route';
import { matchResourceDetailRoute } from './routes/match-resource-detail-route';
import { ResourceDetailPage } from './pages/ResourceDetailPage';

export function App() {
  const coverageRoute = matchCoverageRoute(window.location.pathname);
  const resourceDetailRoute = matchResourceDetailRoute(window.location.pathname);

  if (coverageRoute) {
    return <CoveragePage />;
  }

  if (resourceDetailRoute) {
    return <ResourceDetailPage resourceId={resourceDetailRoute.resourceId} />;
  }

  return <DashboardRoute />;
}
