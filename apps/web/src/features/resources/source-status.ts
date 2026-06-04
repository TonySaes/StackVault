import type { PublicSourceStatus } from '../../api/source-status';

type SourceStatusTone = 'verified' | 'warning' | 'danger' | 'neutral';

interface SourceStatusPresentation {
  label: string;
  tone: SourceStatusTone;
}

// Source status presentation
// The API keeps source statuses technical. Public components use this helper so
// cards, details and coverage explain the same status with the same wording.
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
    default:
      return {
        label: 'Source a verifier',
        tone: 'warning',
      };
  }
}
