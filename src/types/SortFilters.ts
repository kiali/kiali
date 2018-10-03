export interface SortField<T> {
  id: string;
  title: string;
  isNumeric: boolean;
  param: string;
  compare: (a: T, b: T) => number;
}
