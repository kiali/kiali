import { Health } from '../types/Health';

export interface SortField<T> {
  id: string;
  title: string;
  isNumeric: boolean;
  param: string;
  compare: (a: T | WithHealth<T>, b: T | WithHealth<T>) => number;
}
type WithHealth<T> = T & { health: Health };
