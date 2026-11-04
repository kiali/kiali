import React from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

export const useLocationContext = (): [
  string | undefined,
  string | undefined,
  string | undefined,
  string | undefined,
  string | undefined
] => {
  const location = useLocation();
  const path = location?.pathname;
  const search = location?.search;

  return React.useMemo(() => {
    let newKind = '';
    let newName = '';
    let newNamespace = '';
    let newIstio = '';

    const searchParams = new URLSearchParams(search);
    const newClusterName = searchParams.get('clusterName') || '';
    const nsParams = searchParams.getAll('namespace');
    const nssParams = searchParams.getAll('namespaces');

    let parsedNamespaces: string[] = [];
    if (nsParams.length > 0) {
      parsedNamespaces = nsParams.flatMap(ns => ns.split(','));
    } else if (nssParams.length > 0) {
      parsedNamespaces = nssParams.flatMap(ns => ns.split(','));
    }

    if (parsedNamespaces.length > 0) {
      newNamespace = parsedNamespaces.join(',');
    }

    if (path) {
      const parts = path.split('/').filter(Boolean);

      if (parts.length > 0) {
        const firstPart = parts[0];

        const generalPaths = [
          'overview',
          'applications',
          'services',
          'workloads',
          'istio',
          'namespaces',
          'mesh',
          'graph'
        ];

        if (generalPaths.includes(firstPart)) {
          newKind = firstPart;
        }

        if (firstPart === 'namespace' || firstPart === 'namespaces') {
          if (parts.length === 2) {
            newKind = 'namespace';
            newName = parts[1];
          } else if (parts.length >= 4) {
            newNamespace = parts[1];
            const resType = parts[2];

            if (resType === 'applications') {
              newKind = 'application';
              newName = parts[3];
            } else if (resType === 'services') {
              newKind = 'service';
              newName = parts[3];
            } else if (resType === 'workloads') {
              newKind = 'workload';
              newName = parts[3];
            } else if (resType === 'istio') {
              newKind = 'istio';
              newName = parts[parts.length - 1];
              newIstio = parts.slice(3, parts.length - 1).join('/');
            }
          }
        }
      }
    }

    return [
      newKind || undefined,
      newName || undefined,
      newNamespace || undefined,
      newIstio || undefined,
      newClusterName || undefined
    ];
  }, [path, search]);
};
