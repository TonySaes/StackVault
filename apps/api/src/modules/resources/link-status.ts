// Public link status contract
// Prisma stores `Resource.linkStatus` as a plain string. The public API keeps a
// narrower contract so dashboard/detail consumers never receive arbitrary DB
// values.
export const PUBLIC_RESOURCE_LINK_STATUSES = [
  'active',
  'unavailable',
  'redirect',
  'unknown',
  'to_verify',
] as const;

export type PublicResourceLinkStatus =
  (typeof PUBLIC_RESOURCE_LINK_STATUSES)[number];

export const PUBLIC_RESOURCE_LINK_STATUS_FALLBACK: PublicResourceLinkStatus =
  'to_verify';

const publicResourceLinkStatusSet = new Set<string>(
  PUBLIC_RESOURCE_LINK_STATUSES,
);

// Runtime normalization
// A TypeScript union disappears once the code runs. This guard protects the HTTP
// contract when an old migration, manual edit or future provider writes an
// unsupported string into the database.
export function normalizePublicLinkStatus(
  linkStatus: string,
): PublicResourceLinkStatus {
  if (publicResourceLinkStatusSet.has(linkStatus)) {
    return linkStatus as PublicResourceLinkStatus;
  }

  return PUBLIC_RESOURCE_LINK_STATUS_FALLBACK;
}
