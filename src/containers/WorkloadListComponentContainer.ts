import { connect } from 'react-redux';

import { KialiAppState } from '../store/Store';
import WorkloadListComponent from '../pages/WorkloadList/WorkloadListComponent';
import { activeNamespacesSelector } from '../store/Selectors';

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state)
});

const WorkloadListComponentContainer = connect(
  mapStateToProps,
  null
)(WorkloadListComponent);
export default WorkloadListComponentContainer;
