// Public resources API contract
// These interfaces mirror the JSON returned by GET /api/v1/resources.
// They stay close to the backend response so UI components can depend on a
// typed contract without knowing HTTP details.
export interface PublicResourceSource {
  id: string;
  name: string;
  url: string;
  type: string;
  status: string;
}

export interface PublicResourceCategory {
  id: string;
  name: string;
  slug: string;
  signalType: string;
}

export interface PublicResourceTechnology {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface PublicResource {
  id: string;
  title: string;
  shortSummary: string | null;
  sourceUrl: string;
  canonicalUrl: string;
  publishedAt: string | null;
  detectedAt: string;
  lifecycleStatus: string;
  linkStatus: string;
  source: PublicResourceSource;
  category: PublicResourceCategory;
  technologies: PublicResourceTechnology[];
}

export interface PaginatedResourcesResponse {
  items: PublicResource[];
  page: number;
  pageSize: number;
  total: number;
}

export class ResourceNotFoundError extends Error {
  constructor(resourceId: string) {
    super(`Resource not found: ${resourceId}`);
    this.name = 'ResourceNotFoundError';
  }
}

// API transport
// The URL is configured per environment, with a local fallback for Vite +
// NestJS development. Dashboard components should call fetchResources()
// instead of constructing endpoint URLs themselves.
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';

export async function fetchResources(): Promise<PaginatedResourcesResponse> {
  const response = await fetch(`${apiBaseUrl}/resources`);

  if (!response.ok) {
    throw new Error('Resources request failed');
  }

  return (await response.json()) as PaginatedResourcesResponse;
}

export async function fetchResource(resourceId: string): Promise<PublicResource> {
  const response = await fetch(
    `${apiBaseUrl}/resources/${encodeURIComponent(resourceId)}`,
  );

  if (response.status === 404) {
    throw new ResourceNotFoundError(resourceId);
  }

  if (!response.ok) {
    throw new Error('Resource request failed');
  }

  return (await response.json()) as PublicResource;
}
