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

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';

export async function fetchResources(): Promise<PaginatedResourcesResponse> {
  const response = await fetch(`${apiBaseUrl}/resources`);

  if (!response.ok) {
    throw new Error('Resources request failed');
  }

  return (await response.json()) as PaginatedResourcesResponse;
}
