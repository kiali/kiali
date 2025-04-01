import { GraphDataStateReducer } from '../GraphDataState';
import { GraphActions } from '../../actions/GraphActions';
import { GlobalActions } from '../../actions/GlobalActions';
import { DefaultTrafficRates, EdgeMode, GraphType } from '../../types/Graph';
import { GraphState } from 'store/Store';
import { GraphElement } from '@patternfly/react-topology';
import { GraphLayout } from 'pages/Graph/Graph';

describe('GraphDataState', () => {
  it('should return the initial state', () => {
    expect(GraphDataStateReducer(undefined, GlobalActions.unknown())).toEqual({
      edgeMode: EdgeMode.ALL,
      graphDefinition: null,
      layout: GraphLayout.Dagre,
      namespaceLayout: GraphLayout.Dagre,
      node: undefined,
      rankResult: { upperBound: 0 },
      summaryData: null,
      toolbarState: {
        boxByCluster: true,
        boxByNamespace: true,
        edgeLabels: [],
        findValue: '',
        graphType: GraphType.VERSIONED_APP,
        hideValue: '',
        rankBy: [],
        showFindHelp: false,
        showLegend: false,
        showIdleEdges: false,
        showIdleNodes: false,
        showOutOfMesh: true,
        showOperationNodes: false,
        showRank: false,
        showSecurity: false,
        showServiceNodes: true,
        showTrafficAnimation: false,
        showVirtualServices: true,
        trafficRates: DefaultTrafficRates,
        showWaypoints: false
      },
      updateTime: 0
    } as GraphState);
  });

  it('should handle UPDATE_SUMMARY', () => {
    const action = GraphActions.updateSummary({ summaryType: 'node', summaryTarget: {} as GraphElement });
    const updatedState = GraphDataStateReducer(undefined, action);

    expect(updatedState.summaryData).toEqual({ summaryType: 'node', summaryTarget: {} as GraphElement });
  });
});
