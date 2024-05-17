import { SortField } from '../../types/SortFilters';
import { NamespaceInfo } from '../../types/NamespaceInfo';
import { i18n } from 'i18n';

export const sortFields: SortField<NamespaceInfo>[] = [
  {
    id: 'namespace',
    title: i18n.t('Name'),
    isNumeric: false,
    param: 'ns',
    compare: (a: NamespaceInfo, b: NamespaceInfo): number => a.name.localeCompare(b.name)
  },
  {
    id: 'health',
    title: i18n.t('Health'),
    isNumeric: false,
    param: 'h',
    compare: (a: NamespaceInfo, b: NamespaceInfo): number => {
      if (a.status && b.status) {
        let diff = b.status.inError.length - a.status.inError.length;
        if (diff !== 0) {
          return diff;
        }

        diff = b.status.inWarning.length - a.status.inWarning.length;
        if (diff !== 0) {
          return diff;
        }
      } else if (a.status) {
        return -1;
      } else if (b.status) {
        return 1;
      }
      // default comparison fallback
      return a.name.localeCompare(b.name);
    }
  },
  {
    id: 'mtls',
    title: i18n.t('mTLS'),
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
    title: i18n.t('Istio Config'),
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
    title: i18n.t('Cluster'),
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
