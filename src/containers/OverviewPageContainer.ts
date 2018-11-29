import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';

import { KialiAppState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { NamespaceActions } from '../actions/NamespaceAction';
import Namespace from '../types/Namespace';
import OverviewPage from '../pages/Overview/OverviewPage';

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setActiveNamespace: (namespace: Namespace) => {
      dispatch(NamespaceActions.setActiveNamespaces([namespace]));
    }
  };
};

const OverviewPageContainer = connect(
  null,
  mapDispatchToProps
)(OverviewPage);
export default OverviewPageContainer;
