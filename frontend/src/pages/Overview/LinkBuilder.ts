import { URLParam } from '../../app/History';
import { camelCase } from 'lodash';
import { categoryFilter, healthFilter, NamespaceCategory } from '../Namespaces/Filters';
import { isMultiCluster, Paths } from '../../config';
import { DEGRADED, FAILURE, HealthStatusId, NOT_READY } from '../../types/Health';
import { IstioConfigStatusLabel } from 'hooks/istioConfigs';
import { getIstioObjectGVK } from 'utils/IstioConfigUtils';

const typeFilterParam = camelCase(categoryFilter.category);
const healthFilterParam = camelCase(healthFilter.category);
const controlPlaneParamValue = NamespaceCategory.CONTROL_PLANE;
const dataPlaneParamValue = NamespaceCategory.DATA_PLANE;

export const buildMeshUrl = (clusterName?: string): string => {
  if (clusterName) {
    const params = new URLSearchParams();
    // Use Mesh "Hide" expression to effectively filter the view to a single cluster.
    // See Mesh Find/Hide semantics in `pages/Mesh/toolbar/MeshFind.tsx`.
    params.set(URLParam.MESH_HIDE, `cluster!=${clusterName}`);
    return `/${Paths.MESH}?${params.toString()}`;
  }
  // Return clean URL without any find/hide params
  return `/${Paths.MESH}`;
};

export const buildDataPlanesUrl = (status?: HealthStatusId): string => {
  const params = new URLSearchParams();
  params.set(typeFilterParam, dataPlaneParamValue);

  if (status) {
    params.set(healthFilterParam, status);
  }

  return `/${Paths.NAMESPACES}?${params.toString()}`;
};

export const buildUnhealthyDataPlanesUrl = (): string => {
  const params = new URLSearchParams();
  params.set(typeFilterParam, dataPlaneParamValue);
  // The Namespaces "Health" filter supports multiple values via repeated query params.
  // Use ids (not translated titles) to keep the URL stable across locales.
  params.append(healthFilterParam, FAILURE.id);
  params.append(healthFilterParam, DEGRADED.id);
  params.append(healthFilterParam, NOT_READY.id);

  return `/${Paths.NAMESPACES}?${params.toString()}`;
};

export const buildControlPlanesUrl = (status?: HealthStatusId): string => {
  const params = new URLSearchParams();
  params.set(typeFilterParam, controlPlaneParamValue);

  if (status) {
    params.set(healthFilterParam, status);
  }

  return `/${Paths.NAMESPACES}?${params.toString()}`;
};

export const buildIstioListUrl = (opts?: {
  configFilters?: IstioConfigStatusLabel[];
  namespaces?: string[];
}): string => {
  const params = new URLSearchParams();
  if (opts?.namespaces && opts.namespaces.length > 0) {
    params.append('namespaces', opts.namespaces.join(','));
  }
  opts?.configFilters?.forEach(label => params.append('config', label));
  if (opts?.configFilters && opts.configFilters.length > 0) {
    params.append('opLabel', 'or');
  }
  const qs = params.toString();
  return `/${Paths.ISTIO}${qs ? `?${qs}` : ''}`;
};

export const buildIstioDetailUrl = (item: {
  apiVersion: string;
  cluster?: string;
  kind: string;
  name: string;
  namespace: string;
}): string => {
  const gvk = getIstioObjectGVK(item.apiVersion, item.kind);

  let url = `/namespaces/${item.namespace}/${Paths.ISTIO}/${gvk.Group}/${gvk.Version}/${gvk.Kind}/${item.name}`;

  if (item.cluster && isMultiCluster) {
    url += `?clusterName=${item.cluster}`;
  }

  return url;
};

export const buildApplicationsUrl = (namespaces?: string[]): string => {
  let url = `/${Paths.APPLICATIONS}`;

  if (namespaces && namespaces.length > 0) {
    url += `?namespaces=${namespaces.join(',')}`;
  }

  return url;
};
