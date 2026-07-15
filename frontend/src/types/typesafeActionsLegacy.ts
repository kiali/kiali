import type { ActionType } from 'typesafe-actions';
import { deprecated, getType } from 'typesafe-actions';

export type { ActionType };

export const { createAction, createCustomAction, createStandardAction } = deprecated;

export { getType };
