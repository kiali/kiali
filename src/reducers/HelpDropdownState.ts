import { StatusState } from '../store/Store';
import { HelpDropdownActionKeys } from '../actions/HelpDropdownActions';

const INITIAL_STATE: StatusState = {
  status: {},
  components: [],
  warningMessages: []
};

// This Reducer allows changes to the 'serviceGraphDataState' portion of Redux Store
const HelpDropdownState = (state: StatusState = INITIAL_STATE, action) => {
  switch (action.type) {
    case HelpDropdownActionKeys.STATUS_REFRESH:
      return Object.assign({}, INITIAL_STATE, {
        status: action.status,
        components: action.components,
        warningMessages: action.warningMessages
      });
    default:
      return state;
  }
};

export default HelpDropdownState;
