import { Health } from '../types/Health';

export interface SortField<T> {
  id: string;
  title: string;
  isNumeric: boolean;
  param: string;
  compare: <A extends T>(a: A, b: A) => number;
}

export type HealthSortField<T> = SortField<T & { health: typeof Health }>;
export type GenericSortField<T> = SortField<T> | HealthSortField<T>;
