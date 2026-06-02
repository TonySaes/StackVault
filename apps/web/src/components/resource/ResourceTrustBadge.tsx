import './ResourceTrustBadge.css';

type ResourceTrustBadgeTone =
  | 'verified'
  | 'info'
  | 'warning'
  | 'danger'
  | 'neutral';

interface ResourceTrustBadgeProps {
  label: string;
  tone: ResourceTrustBadgeTone;
  accessibleLabel?: string;
}

export function ResourceTrustBadge({
  label,
  tone,
  accessibleLabel,
}: ResourceTrustBadgeProps) {
  return (
    <span
      className="resource-trust-badge"
      data-tone={tone}
      aria-label={accessibleLabel ?? label}
    >
      {label}
    </span>
  );
}
