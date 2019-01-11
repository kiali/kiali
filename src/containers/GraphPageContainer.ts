import { RouteComponentProps, withRouter } from 'react-router';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import {
  activeNamespacesSelector,
  durationSelector,
  refreshIntervalSelector,
  graphTypeSelector,
  edgeLabelModeSelector
} from '../store/Selectors';

import { KialiAppState } from '../store/Store';
import Namespace from '../types/Namespace';
import { EdgeLabelMode } from '../types/GraphFilter';

import { GraphFilterActions } from '../actions/GraphFilterActions';
import { GraphType, NodeParamsType } from '../types/Graph';
import { DurationInSeconds } from '../types/Common';
import GraphPage from '../pages/Graph/GraphPage';
import { GraphActions } from '../actions/GraphActions';
import { KialiAppAction } from '../actions/KialiAppAction';
import GraphDataThunkActions from '../actions/GraphDataThunkActions';

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state),
  edgeLabelMode: edgeLabelModeSelector(state),
  graphData: state.graph.graphData,
  graphDuration: state.graph.graphDataDuration,
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
  summaryData: state.graph.summaryData
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
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
  graphChanged: bindActionCreators(GraphActions.changed, dispatch),
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
