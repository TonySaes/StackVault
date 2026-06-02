import type { PublicResource } from '../../api/resources-api';

export type ResourceSignalGroupKey = 'security' | 'release' | 'trend' | 'other';

export interface ResourceSignalGroup {
  key: ResourceSignalGroupKey;
  resources: PublicResource[];
}

export function groupResourcesBySignal(
  resources: PublicResource[],
): Record<ResourceSignalGroupKey, PublicResource[]> {
  const groups: Record<ResourceSignalGroupKey, PublicResource[]> = {
    security: [],
    release: [],
    trend: [],
    other: [],
  };

  for (const resource of resources) {
    switch (resource.category.signalType) {
      case 'security':
      case 'release':
      case 'trend':
        groups[resource.category.signalType].push(resource);
        break;
      default:
        groups.other.push(resource);
    }
  }

  return groups;
}
