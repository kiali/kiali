import { serverConfig } from 'config';

type NamespaceLike = {
  isAmbient?: boolean;
  isControlPlane?: boolean;
  labels?: Record<string, string>;
};

export type NamespaceMode = 'ambient' | 'sidecar' | 'none';

export interface NamespaceModeInfo {
  color: 'blue' | 'orange' | 'grey';
  displayText: string;
  id: string;
  mode: NamespaceMode;
  priority: number;
}

export const getNamespaceMode = (ns: NamespaceLike): NamespaceMode => {
  if (ns.isAmbient) {
    return 'ambient';
  }

  const labels = ns.labels;
  const injectionEnabled = !!(labels && labels[serverConfig.istioLabels.injectionLabelName] === 'enabled');
  const revisionSet = !!(
    labels &&
    labels[serverConfig.istioLabels.injectionLabelRev] !== undefined &&
    labels[serverConfig.istioLabels.injectionLabelRev] !== ''
  );

  if (ns.isControlPlane || injectionEnabled || revisionSet) {
    return 'sidecar';
  }

  return 'none';
};

export const getNamespaceModeInfo = (ns: NamespaceLike): NamespaceModeInfo => {
  const mode = getNamespaceMode(ns);

  switch (mode) {
    case 'ambient':
      return {
        id: 'ambient',
        mode: 'ambient',
        displayText: 'Ambient',
        color: 'blue',
        priority: 1
      };
    case 'sidecar':
      return {
        id: 'sidecar',
        mode: 'sidecar',
        displayText: 'Sidecar',
        color: 'orange',
        priority: 2
      };
    case 'none':
    default:
      return {
        id: 'none',
        mode: 'none',
        displayText: 'Not applicable',
        color: 'grey',
        priority: 3
      };
  }
};

/**
 * A namespace is considered a data-plane namespace if it is NOT control-plane and it is either:
 * - Ambient enabled, or
 * - Sidecar injection enabled, or
 * - Revision label is set (non-empty)
 *
 * The injection/revision label keys come from `serverConfig.istioLabels.*` so this stays consistent
 * with the rest of the UI.
 */
export const isDataPlaneNamespace = (ns: NamespaceLike): boolean => {
  const mode = getNamespaceMode(ns);
  return !ns.isControlPlane && (mode === 'ambient' || mode === 'sidecar');
};
