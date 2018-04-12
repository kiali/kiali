import { ServiceItem, SortField } from '../../types/ServiceListComponent';

export default class ServiceItemComparer {
  private readonly sortField: SortField;
  private readonly isAscending: boolean;

  constructor(sortField: SortField, isAscending: boolean) {
    this.sortField = sortField;
    this.isAscending = isAscending;
  }

  compareFunction = (a: ServiceItem, b: ServiceItem) => {
    let sortValue = -1;
    if (this.sortField.id === 'namespace') {
      sortValue = a.namespace.localeCompare(b.namespace);
      if (sortValue === 0) {
        sortValue = a.servicename.localeCompare(b.servicename);
      }
    } else if (this.sortField.id === 'istio_sidecar') {
      // Special boolean value, Deployed values first
      if (a.istio_sidecar && !b.istio_sidecar) {
        sortValue = -1;
      } else if (!a.istio_sidecar && b.istio_sidecar) {
        sortValue = 1;
      } else {
        sortValue = a.servicename.localeCompare(b.servicename);
      }
    } else {
      if (this.sortField.isNumeric) {
        // Right now, "Error Rate" is the only numeric filter.
        if (a[this.sortField.id] > b[this.sortField.id]) {
          sortValue = 1;
        } else if (a[this.sortField.id] < b[this.sortField.id]) {
          sortValue = -1;
        } else {
          sortValue = 0;
        }
      } else {
        sortValue = a[this.sortField.id].localeCompare(b[this.sortField.id]);
      }
    }
    return this.isAscending ? sortValue : sortValue * -1;
  };
}
