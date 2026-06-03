// Public coverage API contract
// This file mirrors GET /api/v1/coverage and keeps HTTP details out of pages
// and coverage components.
export interface PublicCoverageTechnology {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface PublicCoverageSource {
  id: string;
  name: string;
  url: string;
  type: string;
  status: string;
}

export interface PublicCoverageResponse {
  technologies: PublicCoverageTechnology[];
  sources: PublicCoverageSource[];
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';

export async function fetchCoverage(): Promise<PublicCoverageResponse> {
  const response = await fetch(`${apiBaseUrl}/coverage`);

  if (!response.ok) {
    throw new Error('Coverage request failed');
  }

  return (await response.json()) as PublicCoverageResponse;
}
