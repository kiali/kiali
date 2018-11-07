import { connect } from 'react-redux';

import { GraphRouteHandler } from '../pages/Graph/GraphRouteHandler';
import { KialiAppState } from '../store/Store';
import { activeNamespaceSelector, durationIntervalSelector } from '../store/Selectors';
import { Dispatch } from 'redux';
import Namespace from '../types/Namespace';
import { NamespaceActions } from '../actions/NamespaceAction';
import { Duration } from '../types/GraphFilter';
import { UserSettingsActions } from '../actions/UserSettingsActions';

const mapStateToProps = (state: KialiAppState) => {
  return {
    activeNamespace: activeNamespaceSelector(state),
    duration: durationIntervalSelector(state)
  };
};

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return {
    setActiveNamespace: (namespace: Namespace) => {
      dispatch(NamespaceActions.setActiveNamespace(namespace));
    },
    setDuration: (duration: Duration) => {
      dispatch(UserSettingsActions.setDurationInterval(duration.value));
    }
  };
};

const GraphRouteHandlerContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphRouteHandler);
export default GraphRouteHandlerContainer;
