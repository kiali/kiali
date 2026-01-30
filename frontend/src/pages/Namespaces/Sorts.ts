import { SortField } from '../../types/SortFilters';
import { NamespaceInfo } from '../../types/NamespaceInfo';
import { t } from 'utils/I18nUtils';

export const sortFields: SortField<NamespaceInfo>[] = [
  {
    id: 'category',
    title: t('Type'),
    isNumeric: false,
    param: 'type',
    compare: (a: NamespaceInfo, b: NamespaceInfo): number => {
      // Control plane comes before Data plane
      if (a.isControlPlane && !b.isControlPlane) {
        return -1;
      } else if (!a.isControlPlane && b.isControlPlane) {
        return 1;
      }
      // If same category, sort by name
      return a.name.localeCompare(b.name);
    }
  },
  {
    id: 'namespace',
    title: t('Name'),
    isNumeric: false,
    param: 'ns',
    compare: (a: NamespaceInfo, b: NamespaceInfo): number => a.name.localeCompare(b.name)
  },
  {
    id: 'health',
    title: t('Health'),
    isNumeric: false,
    param: 'h',
    compare: (a: NamespaceInfo, b: NamespaceInfo): number => {
      // Helper function to get worst status priority (lower number = worse status)
      const getWorstStatusPriority = (ns: NamespaceInfo): number => {
        // Namespaces page: check all three status types and get worst across all
        if (ns.statusApp || ns.statusService || ns.statusWorkload) {
          let worstPriority = 6;
          [ns.statusApp, ns.statusService, ns.statusWorkload].forEach(status => {
            if (status) {
              if (status.inError.length > 0 && worstPriority > 1) worstPriority = 1;
              else if (status.inWarning.length > 0 && worstPriority > 2) worstPriority = 2;
              else if (status.inNotReady.length > 0 && worstPriority > 3) worstPriority = 3;
              else if (status.inSuccess.length > 0 && worstPriority > 4) worstPriority = 4;
              else if (status.notAvailable.length > 0 && worstPriority > 5) worstPriority = 5;
            }
          });
          return worstPriority;
        }
        return 6; // No status
      };

      // Helper function to get total error count
      const getErrorCount = (ns: NamespaceInfo): number => {
        let count = 0;
        [ns.statusApp, ns.statusService, ns.statusWorkload].forEach(status => {
          if (status) {
            count += status.inError.length;
          }
        });
        return count;
      };

      // Helper function to get total warning count
      const getWarningCount = (ns: NamespaceInfo): number => {
        let count = 0;
        [ns.statusApp, ns.statusService, ns.statusWorkload].forEach(status => {
          if (status) {
            count += status.inWarning.length;
          }
        });
        return count;
      };

      const aPriority = getWorstStatusPriority(a);
      const bPriority = getWorstStatusPriority(b);

      // Sort by worst status priority first
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // If same priority, sort by error count
      const aErrors = getErrorCount(a);
      const bErrors = getErrorCount(b);
      if (aErrors !== bErrors) {
        return bErrors - aErrors;
      }

      // If same error count, sort by warning count
      const aWarnings = getWarningCount(a);
      const bWarnings = getWarningCount(b);
      if (aWarnings !== bWarnings) {
        return bWarnings - aWarnings;
      }

      // Default comparison fallback
      return a.name.localeCompare(b.name);
    }
  },
  {
    id: 'mtls',
    title: t('mTLS'),
    isNumeric: false,
    param: 'm',
    compare: (a: NamespaceInfo, b: NamespaceInfo): number => {
      if (a.tlsStatus && b.tlsStatus) {
        return a.tlsStatus.status.localeCompare(b.tlsStatus.status);
      } else if (a.tlsStatus) {
        return -1;
      } else if (b.tlsStatus) {
        return 1;
      }

      // default comparison fallback
      return a.name.localeCompare(b.name);
    }
  },
  {
    id: 'config',
    title: t('Istio Config'),
    isNumeric: false,
    param: 'ic',
    compare: (a: NamespaceInfo, b: NamespaceInfo): number => {
      if (a.validations && b.validations) {
        if (a.validations.errors === b.validations.errors) {
          if (a.validations.warnings === b.validations.warnings) {
            if (a.validations.objectCount && b.validations.objectCount) {
              if (a.validations.objectCount === b.validations.objectCount) {
                // If all equal, use name for sorting
                return a.name.localeCompare(b.name);
              } else {
                return a.validations.objectCount > b.validations.objectCount ? -1 : 1;
              }
            } else if (a.validations.objectCount) {
              return -1;
            } else if (b.validations.objectCount) {
              return 1;
            }
          } else {
            return a.validations.warnings > b.validations.warnings ? -1 : 1;
          }
        } else {
          return a.validations.errors > b.validations.errors ? -1 : 1;
        }
      } else if (a.validations) {
        return -1;
      } else if (b.validations) {
        return 1;
      }

      // default comparison fallback
      return a.name.localeCompare(b.name);
    }
  },
  {
    id: 'cluster',
    title: t('Cluster'),
    isNumeric: false,
    param: 'cl',
    compare: (a: NamespaceInfo, b: NamespaceInfo): number => {
      if (a.cluster && b.cluster) {
        let sortValue = a.cluster.localeCompare(b.cluster);

        if (sortValue === 0) {
          sortValue = a.name.localeCompare(b.name);
        }

        return sortValue;
      } else {
        return 0;
      }
    }
  },
  {
    id: 'revision',
    title: t('Revision'),
    isNumeric: false,
    param: 'rev',
    compare: (a: NamespaceInfo, b: NamespaceInfo): number => {
      const aRev = a.revision ?? '';
      const bRev = b.revision ?? '';
      const cmp = aRev.localeCompare(bRev);
      if (cmp !== 0) {
        return cmp;
      }
      return a.name.localeCompare(b.name);
    }
  }
];

export const sortFunc = (
  allNamespaces: NamespaceInfo[],
  sortField: SortField<NamespaceInfo>,
  isAscending: boolean
): NamespaceInfo[] => {
  const sortedNamespaces = allNamespaces.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
  return sortedNamespaces;
};
