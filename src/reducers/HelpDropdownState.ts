import { StatusState } from '../store/Store';
import { HelpDropdownActionKeys } from '../actions/HelpDropdownActions';

export const INITIAL_STATUS_STATE: StatusState = {
  status: {},
  components: [],
  warningMessages: []
};

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
const HelpDropdownState = (state: StatusState = INITIAL_STATUS_STATE, action) => {
  switch (action.type) {
    case HelpDropdownActionKeys.STATUS_REFRESH:
      return Object.assign({}, INITIAL_STATUS_STATE, {
        status: action.status,
        components: action.components,
        warningMessages: action.warningMessages
      });
    default:
      return state;
  }
};

export default HelpDropdownState;
