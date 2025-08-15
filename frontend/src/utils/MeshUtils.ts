import { store } from '../store/ConfigStore';

// isControlPlaneAccessible returns true if the user has access to any control plane namespace
export const isControlPlaneAccessible = (cluster?: string): boolean => {
  const ns = store.getState().namespaces;

  return (
    ns.items !== undefined &&
    ns.items.some(nsItem => {
      if (cluster) {
        return nsItem.isControlPlane && nsItem.cluster === cluster;
      }
      return nsItem.isControlPlane;
    })
  );
};
