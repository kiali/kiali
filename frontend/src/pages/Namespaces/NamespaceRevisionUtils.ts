import { INJECTION_LABEL_REV } from 'config/ServerConfig';

type NamespaceLike = {
  labels?: Record<string, string>;
};

let controlPlaneRevisions: Set<string> = new Set();

export const setControlPlaneRevisions = (revisions: Set<string>): void => {
  controlPlaneRevisions = revisions;
};

export const isRevisionAvailable = (ns: NamespaceLike): boolean => {
  const rev = ns.labels?.[INJECTION_LABEL_REV] ?? ns.labels?.['istio.io/rev'];
  if (!rev) {
    return true;
  }
  return rev
    .split(',')
    .map(r => r.trim())
    .filter(r => r !== '')
    .every(r => controlPlaneRevisions.has(r));
};
