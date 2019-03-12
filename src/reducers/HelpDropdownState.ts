import { getType } from 'typesafe-actions';
import { StatusState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { HelpDropdownActions } from '../actions/HelpDropdownActions';

export const INITIAL_STATUS_STATE: StatusState = {
  status: {},
  components: [],
  warningMessages: []
};

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
const HelpDropdownState = (state: StatusState = INITIAL_STATUS_STATE, action: KialiAppAction): StatusState => {
  switch (action.type) {
    case getType(HelpDropdownActions.statusRefresh):
      return {
        ...INITIAL_STATUS_STATE,
        status: action.payload.status,
        components: action.payload.components,
        warningMessages: action.payload.warningMessages
      };
    default:
      return state;
  }
};

export default HelpDropdownState;
