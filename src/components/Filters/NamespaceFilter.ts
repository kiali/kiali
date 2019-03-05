import * as API from '../../services/Api';
import { FILTER_ACTION_APPEND, FilterType } from '../../types/Filters';

export class NamespaceFilter {
  static id = 'namespaces';
  static category = 'Namespace';

  static create = (): FilterType => {
    return {
      id: NamespaceFilter.id,
      title: NamespaceFilter.category,
      placeholder: 'Filter by Namespace',
      filterType: 'select',
      action: FILTER_ACTION_APPEND,
      filterValues: [],
      loader: () =>
        API.getNamespaces().then(response => {
          return response.data.map(ns => ({ title: ns.name, id: ns.name }));
        })
    };
  };
}

export default NamespaceFilter;
