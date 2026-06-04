import type { PublicSourceStatus } from '../../api/source-status';

type SourceStatusTone = 'verified' | 'warning' | 'danger' | 'neutral';

interface SourceStatusPresentation {
  label: string;
  tone: SourceStatusTone;
}

// Source status presentation
// The API keeps source statuses technical. Public components use this helper so
// resource and coverage views explain the same source status with the same words.
export function getSourceStatusPresentation(
  sourceStatus: PublicSourceStatus,
): SourceStatusPresentation {
  switch (sourceStatus) {
    case 'active':
      return {
        label: 'Source active',
        tone: 'verified',
      };
    case 'inactive':
      return {
        label: 'Source inactive',
        tone: 'neutral',
      };
    case 'error':
      return {
        label: 'Source en erreur',
        tone: 'danger',
      };
    case 'to_verify':
      return {
        label: 'Source a verifier',
        tone: 'warning',
      };
    default:
      return {
        label: 'Source a verifier',
        tone: 'warning',
      };
  }
}
