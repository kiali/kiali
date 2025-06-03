import { ExternalLink } from './Dashboards';

export const ISTIO_MESH_DASHBOARD = 'Istio Mesh Dashboard';
export const ISTIO_CONTROL_PLANE_DASHBOARD = 'Istio Control Plane Dashboard';
export const ISTIO_PERFORMANCE_DASHBOARD = 'Istio Performance Dashboard';
export const ISTIO_WASM_EXTENSION_DASHBOARD = 'Istio Wasm Extension Dashboard';

export const ISTIO_DASHBOARDS: string[] = [
  ISTIO_MESH_DASHBOARD,
  ISTIO_CONTROL_PLANE_DASHBOARD,
  ISTIO_PERFORMANCE_DASHBOARD,
  ISTIO_WASM_EXTENSION_DASHBOARD
];

export interface GrafanaInfo {
  datasourceUID?: string;
  externalLinks: ExternalLink[];
}
