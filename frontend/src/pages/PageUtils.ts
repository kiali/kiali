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

export const isTemplatedWorkloadKind = (kind: string): boolean => templatedWorkloadKinds.has(kind);

export const LAST_APPLIED_ANNOTATION = 'kubectl.kubernetes.io/last-applied-configuration';

/** Hide noisy system annotations from display and edit diffs. */
export const filterHiddenAnnotations = (annotations: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(annotations ?? {}).filter(([key]) => key !== LAST_APPLIED_ANNOTATION));

export type WorkloadAnnotationSources = {
  annotations?: Record<string, string>;
  gvk?: { Kind?: string };
  templateAnnotations?: Record<string, string>;
};

/**
 * Merges controller and pod-template annotations for display on templated workloads.
 * Template values win when the same key exists on both. Matches service/namespace detail pages
 * while surfacing Istio proxy configuration from the pod template.
 */
export const getWorkloadAnnotations = (workload: WorkloadAnnotationSources): Record<string, string> => {
  const kind = workload.gvk?.Kind ?? '';
  const controller = filterHiddenAnnotations(workload.annotations ?? {});
  if (!isTemplatedWorkloadKind(kind)) {
    return controller;
  }
  const template = filterHiddenAnnotations(workload.templateAnnotations ?? {});
  return { ...controller, ...template };
};

/** Applies annotation edits to the correct metadata layer without clobbering unrelated keys. */
export const buildWorkloadAnnotationsPatch = (
  workload: WorkloadAnnotationSources,
  updated: Record<string, string>
): string => {
  const kind = workload.gvk?.Kind ?? '';
  if (!isTemplatedWorkloadKind(kind)) {
    return buildWorkloadMetadataPatch('annotations', getWorkloadAnnotations(workload), updated, kind);
  }

  const controllerOriginal = filterHiddenAnnotations(workload.annotations ?? {});
  const templateOriginal = filterHiddenAnnotations(workload.templateAnnotations ?? {});
  const displayOriginal = getWorkloadAnnotations(workload);

  const controllerPatch: Record<string, string | null> = {};
  const templatePatch: Record<string, string | null> = {};

  for (const [key, value] of Object.entries(updated)) {
    if (key in displayOriginal && displayOriginal[key] === value) {
      continue;
    }
    if (key in templateOriginal || !(key in controllerOriginal)) {
      templatePatch[key] = value;
    } else {
      controllerPatch[key] = value;
    }
  }

  for (const key of Object.keys(displayOriginal)) {
    if (!(key in updated)) {
      if (key in templateOriginal) {
        templatePatch[key] = null;
      } else if (key in controllerOriginal) {
        controllerPatch[key] = null;
      }
    }
  }

  const patch: {
    metadata?: { annotations: Record<string, string | null> };
    spec?: { template: { metadata: { annotations: Record<string, string | null> } } };
  } = {};

  if (Object.keys(controllerPatch).length > 0) {
    patch.metadata = { annotations: controllerPatch };
  }
  if (Object.keys(templatePatch).length > 0) {
    patch.spec = { template: { metadata: { annotations: templatePatch } } };
  }

  return JSON.stringify(patch);
};

/** Re-attach hidden annotations so saves do not delete system-managed metadata. */
export const preserveHiddenAnnotations = (
  original: Record<string, string>,
  updatedVisible: Record<string, string>
): Record<string, string> => {
  const hidden = Object.fromEntries(Object.entries(original ?? {}).filter(([key]) => key === LAST_APPLIED_ANNOTATION));
  return { ...hidden, ...updatedVisible };
};

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

export const partitionByIstio = (
  entries: Record<string, string>
): { istioCount: number; sorted: Record<string, string> } => {
  const keys = Object.keys(entries);
  const istioKeys = keys.filter(k => k.toLowerCase().includes('istio')).sort();
  const otherKeys = keys.filter(k => !k.toLowerCase().includes('istio')).sort();
  const sorted: Record<string, string> = {};
  for (const k of [...istioKeys, ...otherKeys]) {
    sorted[k] = entries[k];
  }
  return { sorted, istioCount: istioKeys.length };
};
