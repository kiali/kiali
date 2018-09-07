import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import Namespace from '../types/Namespace';
import { Duration } from '../types/GraphFilter';
import GraphPage from '../pages/Graph/GraphPage';

import { ServiceGraphDataActions } from '../actions/ServiceGraphDataActions';
import { serviceGraphFilterActions } from '../actions/ServiceGraphFilterActions';
import { bindActionCreators } from 'redux';
import { GraphType, NodeParamsType } from '../types/Graph';

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
  pollInterval: state.serviceGraph.filterState.refreshRate,
  isPageVisible: state.globalState.isPageVisible,
  isError: state.serviceGraph.isError
});

const mapDispatchToProps = (dispatch: any) => ({
  fetchGraphData: (
    namespace: Namespace,
    graphDuration: Duration,
    graphType: GraphType,
    injectServiceNodes: boolean,
    node?: NodeParamsType
  ) => dispatch(ServiceGraphDataActions.fetchGraphData(namespace, graphDuration, graphType, injectServiceNodes, node)),
  toggleLegend: bindActionCreators(serviceGraphFilterActions.toggleLegend, dispatch)
});

const GraphPageConnected = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphPage);
export default GraphPageConnected;
