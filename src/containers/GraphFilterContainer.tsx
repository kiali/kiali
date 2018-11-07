import { connect } from 'react-redux';
import { Dispatch } from 'redux';
import { Duration } from '../types/GraphFilter';
import { UserSettingsActions } from '../actions/UserSettingsActions';
import GraphFilter from '../components/GraphFilter/GraphFilter';

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return {
    setDuration: (duration: Duration) => {
      dispatch(UserSettingsActions.setDurationInterval(duration.value));
    }
  };
};

const GraphFilterContainer = connect(
  null,
  mapDispatchToProps
)(GraphFilter);
export default GraphFilterContainer;
