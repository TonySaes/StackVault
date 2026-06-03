interface ResourceDetailRouteMatch {
  resourceId: string;
}

export function matchResourceDetailRoute(
  pathname: string,
): ResourceDetailRouteMatch | null {
  const match = pathname.match(/^\/resources\/([^/]+)\/?$/);
  const resourceId = match?.[1];

  return resourceId ? { resourceId: decodeURIComponent(resourceId) } : null;
}
