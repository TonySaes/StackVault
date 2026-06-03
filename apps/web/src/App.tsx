import { DashboardRoute } from './routes/DashboardRoute';
import { matchResourceDetailRoute } from './routes/match-resource-detail-route';
import { ResourceDetailPage } from './pages/ResourceDetailPage';

export function App() {
  const resourceDetailRoute = matchResourceDetailRoute(window.location.pathname);

  if (resourceDetailRoute) {
    return <ResourceDetailPage resourceId={resourceDetailRoute.resourceId} />;
  }

  return <DashboardRoute />;
}
