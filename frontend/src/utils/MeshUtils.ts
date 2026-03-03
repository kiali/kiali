import { store } from '../store/ConfigStore';
import { MeshToolbarActions } from '../actions/MeshToolbarActions';

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

/**
 * Reset mesh find/hide filter values to empty strings.
 * This clears any active mesh filtering without affecting other toolbar settings.
 * Use this when navigating to the mesh page and you want to clear any programmatically set filters.
 */
export const resetMeshFilters = (): void => {
  store.dispatch(MeshToolbarActions.setFindValue(''));
  store.dispatch(MeshToolbarActions.setHideValue(''));
};
