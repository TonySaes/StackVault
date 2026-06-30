import type { LinkCheckJobResult } from './link-checks.service.js';

export const DEFAULT_LINK_CHECK_RUN_LIMIT = 20;

export interface LinkCheckRunOptions {
  limit: number;
}

export function shouldPrintLinkCheckUsage(args: readonly string[]): boolean {
  return args.includes('--help') || args.includes('-h');
}

// CLI option parsing
// Keep argument validation separate from the runner so tests can exercise it
// without opening Prisma or touching the network.
export function parseLinkCheckRunOptions(
  args: readonly string[],
): LinkCheckRunOptions {
  const limit = readLimitArg(args) ?? DEFAULT_LINK_CHECK_RUN_LIMIT;

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('link_check.limit_invalid');
  }

  return {
    limit,
  };
}

export function formatLinkCheckRunSummary(
  result: Pick<
    LinkCheckJobResult,
    'checkedResourceCount' | 'updatedResourceCount' | 'failedResourceCount'
  >,
): string {
  const failureLabel = result.failedResourceCount > 1 ? 'echecs' : 'echec';

  return `Verification des liens terminee: ${result.checkedResourceCount} verifies, ${result.updatedResourceCount} mis a jour, ${result.failedResourceCount} ${failureLabel}.`;
}

function readLimitArg(args: readonly string[]): number | undefined {
  const inlineLimit = args.find((arg) => arg.startsWith('--limit='));

  if (inlineLimit !== undefined) {
    return Number(inlineLimit.slice('--limit='.length));
  }

  const limitFlagIndex = args.indexOf('--limit');

  if (limitFlagIndex === -1) {
    return undefined;
  }

  return Number(args[limitFlagIndex + 1]);
}
