import { getType } from 'typesafe-actions';
import { updateState } from '../utils/Reducer';
import { TourState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { TourActions } from '../actions/TourActions';

export const INITIAL_TOUR_STATE: TourState = {
  activeTour: undefined,
  activeStop: undefined
};

export const TourStateReducer = (state: TourState = INITIAL_TOUR_STATE, action: KialiAppAction): TourState => {
  switch (action.type) {
    case getType(TourActions.endTour):
      return updateState(state, { activeTour: undefined, activeStop: undefined });

    case getType(TourActions.setStop): {
      return updateState(state, { activeStop: action.payload });
    }
    case getType(TourActions.startTour):
      return updateState(state, { activeTour: action.payload.info, activeStop: action.payload.stop });

    default:
      return state;
  }
};
