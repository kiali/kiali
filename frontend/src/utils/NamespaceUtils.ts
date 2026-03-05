import { serverConfig } from 'config';

type NamespaceLike = {
  isAmbient?: boolean;
  isControlPlane?: boolean;
  labels?: Record<string, string>;
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
  const labels = ns.labels;
  const injectionEnabled = !!(labels && labels[serverConfig.istioLabels.injectionLabelName] === 'enabled');
  const revisionSet = !!(
    labels &&
    labels[serverConfig.istioLabels.injectionLabelRev] !== undefined &&
    labels[serverConfig.istioLabels.injectionLabelRev] !== ''
  );

  return !ns.isControlPlane && (!!ns.isAmbient || injectionEnabled || revisionSet);
};
