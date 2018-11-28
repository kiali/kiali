import { RouteComponentProps, withRouter } from 'react-router';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { KialiAppState } from '../store/Store';
import {
  activeNamespacesSelector,
  durationSelector,
  refreshIntervalSelector,
  graphTypeSelector,
  edgeLabelModeSelector
} from '../store/Selectors';
import { GraphDataThunkActions } from '../actions/GraphDataActions';
import { GraphFilterActions } from '../actions/GraphFilterActions';
import { GraphType, NodeParamsType } from '../types/Graph';
import { DurationInSeconds } from '../types/Common';
import Namespace from '../types/Namespace';
import { EdgeLabelMode } from '../types/GraphFilter';
import GraphPage from '../pages/Graph/GraphPage';
import { GraphActions } from '../actions/GraphActions';

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state),
  edgeLabelMode: edgeLabelModeSelector(state),
  graphData: state.graph.graphData,
  graphTimestamp: state.graph.graphDataTimestamp,
  graphType: graphTypeSelector(state),
  isError: state.graph.isError,
  isLoading: state.graph.isLoading,
  isPageVisible: state.globalState.isPageVisible,
  layout: state.graph.layout,
  node: state.graph.node,
  pollInterval: refreshIntervalSelector(state),
  showLegend: state.graph.filterState.showLegend,
  showSecurity: state.graph.filterState.showSecurity,
  showServiceNodes: state.graph.filterState.showServiceNodes,
  showUnusedNodes: state.graph.filterState.showUnusedNodes,
  summaryData: state.graph.sidePanelInfo
    ? {
        summaryTarget: state.graph.sidePanelInfo.graphReference,
        summaryType: state.graph.sidePanelInfo.kind
      }
    : null
});

const mapDispatchToProps = (dispatch: any) => ({
  fetchGraphData: (
    namespaces: Namespace[],
    duration: DurationInSeconds,
    graphType: GraphType,
    injectServiceNodes: boolean,
    edgeLabelMode: EdgeLabelMode,
    showSecurity: boolean,
    showUnusedNodes: boolean,
    node?: NodeParamsType
  ) =>
    dispatch(
      GraphDataThunkActions.fetchGraphData(
        namespaces,
        duration,
        graphType,
        injectServiceNodes,
        edgeLabelMode,
        showSecurity,
        showUnusedNodes,
        node
      )
    ),
  setNode: bindActionCreators(GraphActions.setNode, dispatch),
  toggleLegend: bindActionCreators(GraphFilterActions.toggleLegend, dispatch)
});

const GraphPageContainer = withRouter<RouteComponentProps<{}>>(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(GraphPage)
);
export default GraphPageContainer;
