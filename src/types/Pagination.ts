export interface Pagination {
  page: number;
  perPage: number;
  // Note: do not remove perPageOptions even if it never changes: needed in patternfly's Paginator props.
  perPageOptions: number[];
}
