import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import Namespace from '../types/Namespace';
import { Duration, EdgeLabelMode } from '../types/GraphFilter';
import GraphPage from '../pages/Graph/GraphPage';

import { GraphDataActions } from '../actions/GraphDataActions';
import { GraphFilterActions } from '../actions/GraphFilterActions';
import { bindActionCreators } from 'redux';
import { GraphType, NodeParamsType } from '../types/Graph';

const mapStateToProps = (state: KialiAppState) => ({
  graphTimestamp: state.graph.graphDataTimestamp,
  graphData: state.graph.graphData,
  isLoading: state.graph.isLoading,
  summaryData: state.graph.sidePanelInfo
    ? {
        summaryTarget: state.graph.sidePanelInfo.graphReference,
        summaryType: state.graph.sidePanelInfo.kind
      }
    : null,
  showLegend: state.graph.filterState.showLegend,
  pollInterval: state.graph.filterState.refreshRate,
  isPageVisible: state.globalState.isPageVisible,
  showSecurity: state.graph.filterState.showSecurity,
  showUnusedNodes: state.graph.filterState.showUnusedNodes,
  isError: state.graph.isError
});

const mapDispatchToProps = (dispatch: any) => ({
  fetchGraphData: (
    namespace: Namespace,
    graphDuration: Duration,
    graphType: GraphType,
    injectServiceNodes: boolean,
    edgeLabelMode: EdgeLabelMode,
    showSecurity: boolean,
    showUnusedNodes: boolean,
    node?: NodeParamsType
  ) =>
    dispatch(
      GraphDataActions.fetchGraphData(
        namespace,
        graphDuration,
        graphType,
        injectServiceNodes,
        edgeLabelMode,
        showSecurity,
        showUnusedNodes,
        node
      )
    ),
  toggleLegend: bindActionCreators(GraphFilterActions.toggleLegend, dispatch)
});

const GraphPageConnected = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphPage);
export default GraphPageConnected;
