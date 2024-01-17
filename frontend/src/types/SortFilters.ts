import { Health } from '../types/Health';

export interface SortField<T> {
  id: string;
  title: string; // Used when building a dropdown of sort options, this is not a column header
  isNumeric: boolean;
  param: string;
  compare: (a: T | WithHealth<T>, b: T | WithHealth<T>) => number;
}

type WithHealth<T> = T & { health: Health };
