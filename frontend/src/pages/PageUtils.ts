import { URLParam, router } from '../app/History';
import { FilterSelected } from '../components/Filters/StatefulFilters';

export const navigateToFilteredList = (
  path: string,
  key: string,
  value: string,
  namespace?: string,
  labelParam = 'label'
): void => {
  FilterSelected.resetFilters();
  const params = new URLSearchParams();
  if (namespace) {
    params.set(URLParam.NAMESPACES, namespace);
  }
  params.set(labelParam, `${key}=${value}`);
  router.navigate(`/${path}?${params.toString()}`);
};

export const buildMetadataPatch = (
  field: 'labels' | 'annotations',
  original: Record<string, string>,
  updated: Record<string, string>
): string => {
  const patch: Record<string, string | null> = { ...updated };
  Object.keys(original).forEach(key => {
    if (!(key in updated)) {
      patch[key] = null;
    }
  });
  return JSON.stringify({ metadata: { [field]: patch } });
};

const templatedWorkloadKinds = new Set([
  'Deployment',
  'ReplicaSet',
  'ReplicationController',
  'DeploymentConfig',
  'StatefulSet',
  'DaemonSet'
]);

export const buildWorkloadMetadataPatch = (
  field: 'labels' | 'annotations',
  original: Record<string, string>,
  updated: Record<string, string>,
  kind: string
): string => {
  const patch: Record<string, string | null> = { ...updated };
  Object.keys(original).forEach(key => {
    if (!(key in updated)) {
      patch[key] = null;
    }
  });

  if (templatedWorkloadKinds.has(kind)) {
    return JSON.stringify({
      metadata: { [field]: patch },
      spec: { template: { metadata: { [field]: patch } } }
    });
  }
  return JSON.stringify({ metadata: { [field]: patch } });
};
