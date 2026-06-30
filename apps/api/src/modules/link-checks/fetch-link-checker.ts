import type { LinkCheckResult } from './link-check-result.js';
import type { LinkChecker } from './link-checks.service.js';

export interface LinkCheckFetchInit {
  method: 'HEAD';
  redirect: 'manual';
  signal: AbortSignal;
}

export interface LinkCheckFetchResponse {
  status: number;
}

export type LinkCheckFetcher = (
  sourceUrl: string,
  init: LinkCheckFetchInit,
) => Promise<LinkCheckFetchResponse>;

export interface FetchLinkCheckerOptions {
  fetcher?: LinkCheckFetcher;
  timeoutMs?: number;
}

const DEFAULT_LINK_CHECK_TIMEOUT_MS = 5_000;

const defaultFetcher: LinkCheckFetcher = (sourceUrl, init) =>
  fetch(sourceUrl, init);

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export class FetchLinkChecker implements LinkChecker {
  private readonly fetcher: LinkCheckFetcher;
  private readonly timeoutMs: number;

  constructor(options: FetchLinkCheckerOptions = {}) {
    this.fetcher = options.fetcher ?? defaultFetcher;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_LINK_CHECK_TIMEOUT_MS;
  }

  // HTTP probe
  // HEAD avoids reading or storing third-party content. Manual redirects keep
  // 3xx visible so the classifier can persist `redirect` instead of seeing a
  // final 200 after automatic redirect following.
  async checkLink(sourceUrl: string): Promise<LinkCheckResult> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(sourceUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: abortController.signal,
      });

      return {
        kind: 'http_response',
        statusCode: response.status,
      };
    } catch (error) {
      return {
        kind: isAbortError(error) ? 'timeout' : 'network_error',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
