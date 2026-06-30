import type { PublicResourceLinkStatus } from '../resources/link-status.js';

// Link check input contract
// The job will later translate real fetch results into this small shape. Keeping
// the classifier independent from fetch, NestJS and Prisma makes the business
// rule deterministic and cheap to test.
export type LinkCheckResult =
  | {
      kind: 'http_response';
      statusCode: number;
    }
  | {
      kind: 'network_error';
    }
  | {
      kind: 'timeout';
    };

export type LinkCheckStatus = Extract<
  PublicResourceLinkStatus,
  'active' | 'redirect' | 'unavailable' | 'to_verify'
>;

// Status classification
// Redirects must stay visible to StackVault. A future fetch adapter should use
// manual redirect handling; otherwise a 301/302 can become an apparently active
// 200 response after the runtime follows the redirect.
export function classifyLinkCheckResult(
  result: LinkCheckResult,
): LinkCheckStatus {
  if (result.kind !== 'http_response') {
    return 'unavailable';
  }

  if (result.statusCode >= 200 && result.statusCode <= 299) {
    return 'active';
  }

  if (result.statusCode >= 300 && result.statusCode <= 399) {
    return 'redirect';
  }

  if (result.statusCode >= 400 && result.statusCode <= 599) {
    return 'unavailable';
  }

  return 'to_verify';
}
