import { store } from '../store/ConfigStore';
import { serverConfig } from '../config';

// isControlPlaneAccessible returns true if
export const isControlPlaneAccessible = (cluster?: string): boolean => {
  const ns = store.getState().namespaces;

  return (
    ns.items !== undefined &&
    ns.items.some(nsItem => {
      if (cluster) {
        return nsItem.name === serverConfig.istioNamespace && nsItem.cluster === cluster;
      }
      return nsItem.name === serverConfig.istioNamespace;
    })
  );
};
