import { connect } from 'react-redux';

import { NamespaceActions } from '../actions/NamespaceAction';
import Namespace from '../types/Namespace';
import { Dispatch } from 'redux';
import OverviewPage from '../pages/Overview/OverviewPage';
import { UserSettingsActions } from '../actions/UserSettingsActions';
import { PollIntervalInMs } from '../types/Common';
import { KialiAppState } from '../store/Store';
import { durationSelector, refreshIntervalSelector } from '../store/Selectors';
import { GraphActions } from '../actions/GraphActions';

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  pollInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return {
    setActiveNamespace: (namespace: Namespace) => {
      dispatch(GraphActions.changed());
      dispatch(NamespaceActions.setActiveNamespace(namespace));
    },
    setRefreshlInterval: (refresh: PollIntervalInMs) => {
      dispatch(UserSettingsActions.setRefreshInterval(refresh));
    }
  };
};

const OverviewPageContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(OverviewPage);
export default OverviewPageContainer;
