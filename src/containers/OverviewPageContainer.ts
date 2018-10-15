import { connect } from 'react-redux';

import { NamespaceActions } from '../actions/NamespaceAction';
import Namespace from '../types/Namespace';
import { Dispatch } from 'redux';
import OverviewPage from '../pages/Overview/OverviewPage';

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return {
    setActiveNamespace: (namespace: Namespace) => {
      dispatch(NamespaceActions.setActiveNamespace(namespace));
    }
  };
};

const OverviewPageContainer = connect(
  null,
  mapDispatchToProps
)(OverviewPage);
export default OverviewPageContainer;
