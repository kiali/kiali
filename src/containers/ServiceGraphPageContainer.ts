import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import Namespace from '../types/Namespace';
import { Duration } from '../types/GraphFilter';
import ServiceGraphPage from '../pages/ServiceGraph/ServiceGraphPage';

import { ServiceGraphDataActions } from '../actions/ServiceGraphDataActions';
import { serviceGraphFilterActions } from '../actions/ServiceGraphFilterActions';
import { bindActionCreators } from 'redux';

const mapStateToProps = (state: KialiAppState) => ({
  graphTimestamp: state.serviceGraph.graphDataTimestamp,
  graphData: state.serviceGraph.graphData,
  isLoading: state.serviceGraph.isLoading,
  summaryData: state.serviceGraph.sidePanelInfo
    ? {
        summaryTarget: state.serviceGraph.sidePanelInfo.graphReference,
        summaryType: state.serviceGraph.sidePanelInfo.kind
      }
    : null,
  showLegend: state.serviceGraph.filterState.showLegend,
  pollInterval: state.serviceGraph.filterState.refreshRate
});

const mapDispatchToProps = (dispatch: any) => ({
  fetchGraphData: (namespace: Namespace, graphDuration: Duration) =>
    dispatch(ServiceGraphDataActions.fetchGraphData(namespace, graphDuration)),
  toggleLegend: () => bindActionCreators(serviceGraphFilterActions.toggleLegend, dispatch)
});

const ServiceGraphPageConnected = connect(mapStateToProps, mapDispatchToProps)(ServiceGraphPage);
export default ServiceGraphPageConnected;
