import type { ActionType } from 'types/typesafeActionsLegacy';
import { createAction, createStandardAction } from 'types/typesafeActionsLegacy';
import { ActionKeys } from './ActionKeys';
import type { TourInfo } from '../components/Tour/TourStop';

export const TourActions = {
  endTour: createAction(ActionKeys.TOUR_END),
  setStop: createStandardAction(ActionKeys.TOUR_SET_STOP)<number>(),
  startTour: createStandardAction(ActionKeys.TOUR_START)<{ info: TourInfo; stop: number }>()
};

export type TourAction = ActionType<typeof TourActions>;
