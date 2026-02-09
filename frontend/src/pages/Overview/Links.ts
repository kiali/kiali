import { FilterSelected } from '../../components/Filters/StatefulFilters';
import { router, URLParam } from '../../app/History';
import { camelCase } from 'lodash';
import { categoryFilter, healthFilter, NamespaceCategory } from '../Namespaces/Filters';
import { Paths } from '../../config';
import { HealthStatusId } from '../../types/Health';

const typeFilterParam = camelCase(categoryFilter.category);
const healthFilterParam = camelCase(healthFilter.category);
const controlPlaneParamValue = NamespaceCategory.CONTROL_PLANE;
const dataPlaneParamValue = NamespaceCategory.DATA_PLANE;

export const handleViewAllClick = (): void => {
  FilterSelected.resetFilters();
};

export const navigateToUrl = (url: string): void => {
  handleViewAllClick();
  router.navigate(url);
};

export const buildDataPlanesUrl = (status?: HealthStatusId): string => {
  const params = new URLSearchParams();
  params.set(typeFilterParam, dataPlaneParamValue);

  if (status) {
    params.set(healthFilterParam, status);
  }

  return `/${Paths.NAMESPACES}?${params.toString()}`;
};

export const buildMeshUrlWithClusterFilter = (clusterName: string): string => {
  const params = new URLSearchParams();
  // Use Mesh "Hide" expression to effectively filter the view to a single cluster.
  // See Mesh Find/Hide semantics in `pages/Mesh/toolbar/MeshFind.tsx`.
  params.set(URLParam.MESH_HIDE, `cluster!=${clusterName}`);
  return `/${Paths.MESH}?${params.toString()}`;
};

export const buildControlPlanesUrl = (status?: HealthStatusId): string => {
  const params = new URLSearchParams();
  params.set(typeFilterParam, controlPlaneParamValue);

  if (status) {
    params.set(healthFilterParam, status);
  }

  return `/${Paths.NAMESPACES}?${params.toString()}`;
};
