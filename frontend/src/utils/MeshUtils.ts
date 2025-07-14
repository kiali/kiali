import { store } from '../store/ConfigStore';
import { isIstioNamespace } from 'config/ServerConfig';

// isControlPlaneAccessible returns true if
export const isControlPlaneAccessible = (cluster?: string): boolean => {
  const ns = store.getState().namespaces;

  return (
    ns.items !== undefined &&
    ns.items.some(nsItem => {
      if (cluster) {
        return isIstioNamespace(nsItem.name) && nsItem.cluster === cluster;
      }
      return isIstioNamespace(nsItem.name);
    })
  );
};
