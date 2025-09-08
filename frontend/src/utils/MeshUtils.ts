import { store } from '../store/ConfigStore';

// isControlPlaneAccessible returns true if the user has access to any control plane namespace
export const isControlPlaneAccessible = (cluster?: string): boolean => {
  const namespaceState = store.getState().namespaces;

  return (
    namespaceState.namespaces !== undefined &&
    Array.from(namespaceState.namespaces.values()).some(ns => {
      if (cluster) {
        return ns.isControlPlane && ns.cluster === cluster;
      }
      return ns.isControlPlane;
    })
  );
};
