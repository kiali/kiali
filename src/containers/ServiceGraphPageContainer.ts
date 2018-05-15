import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import Namespace from '../types/Namespace';
import { Duration } from '../types/GraphFilter';
import ServiceGraphPage from '../pages/ServiceGraph/ServiceGraphPage';

import { ServiceGraphDataActions } from '../actions/ServiceGraphDataActions';

const mapStateToProps = (state: KialiAppState) => ({
  graphTimestamp: state.serviceGraphDataState.timestamp,
  graphData: state.serviceGraphDataState.graphData,
  isLoading: state.serviceGraphDataState.isLoading
});

const mapDispatchToProps = (dispatch: any) => ({
  fetchGraphData: (namespace: Namespace, graphDuration: Duration) =>
    dispatch(ServiceGraphDataActions.fetchGraphData(namespace, graphDuration))
});

const ServiceGraphPageConnected = connect(mapStateToProps, mapDispatchToProps)(ServiceGraphPage);
export default ServiceGraphPageConnected;
