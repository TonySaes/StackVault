interface ResourceDetailRouteMatch {
  resourceId: string;
}

export function matchResourceDetailRoute(
  pathname: string,
): ResourceDetailRouteMatch | null {
  const match = pathname.match(/^\/resources\/([^/]+)\/?$/);
  const resourceId = match?.[1];

  if (!resourceId) {
    return null;
  }

  try {
    return { resourceId: decodeURIComponent(resourceId) };
  } catch {
    return null;
  }
}
