import { INJECTION_LABEL_REV } from 'config/ServerConfig';
import type { NamespaceInfo } from 'types/NamespaceInfo';

type NamespaceLike = {
  labels?: Record<string, string>;
};

let controlPlaneRevisions: Set<string> = new Set();

export const setControlPlaneRevisions = (revisions: Set<string>): void => {
  controlPlaneRevisions = revisions;
};

export const isRevisionAvailable = (ns: NamespaceLike): boolean => {
  const rev = ns.labels?.[INJECTION_LABEL_REV];
  if (!rev) {
    return true;
  }
  return rev
    .split(',')
    .map(r => r.trim())
    .filter(r => r !== '')
    .every(r => controlPlaneRevisions.has(r));
};

export const getNamespaceRevision = (ns: NamespaceInfo): string | undefined => {
  let revision: string | undefined;
  if (ns.labels?.[INJECTION_LABEL_REV]) {
    revision = ns.labels[INJECTION_LABEL_REV];
  }
  if (!revision || revision === '') {
    revision = ns.revision;
  }
  return revision;
};

export const getNamespaceRevisions = (ns: NamespaceInfo): string[] => {
  const raw = getNamespaceRevision(ns);
  if (!raw || raw === '') {
    return [];
  }
  return raw
    .split(',')
    .map(r => r.trim())
    .filter(r => r !== '');
};
