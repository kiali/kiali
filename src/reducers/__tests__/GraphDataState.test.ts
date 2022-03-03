import graphDataState from '../GraphDataState';
import { GraphActions } from '../../actions/GraphActions';
import { GlobalActions } from '../../actions/GlobalActions';
import { DefaultTrafficRates, EdgeMode, GraphType } from '../../types/Graph';
import { DagreGraph } from '../../components/CytoscapeGraph/graphs/DagreGraph';
import { GraphState } from 'store/Store';

describe('GraphDataState', () => {
  it('should return the initial state', () => {
    expect(graphDataState(undefined, GlobalActions.unknown())).toEqual({
      edgeMode: EdgeMode.ALL,
      graphDefinition: null,
      layout: DagreGraph.getLayout(),
      node: undefined,
      rankResult: { upperBound: 0 },
      summaryData: null,
      toolbarState: {
        boxByCluster: true,
        boxByNamespace: true,
        compressOnHide: true,
        edgeLabels: [],
        findValue: '',
        graphType: GraphType.VERSIONED_APP,
        hideValue: '',
        rankBy: [],
        showFindHelp: false,
        showLegend: false,
        showIdleEdges: false,
        showIdleNodes: false,
        showMissingSidecars: true,
        showOperationNodes: false,
        showRank: false,
        showSecurity: false,
        showServiceNodes: true,
        showTrafficAnimation: false,
        showVirtualServices: true,
        trafficRates: DefaultTrafficRates
      },
      updateTime: 0
    } as GraphState);
  });

  it('should handle UPDATE_SUMMARY', () => {
    const action = GraphActions.updateSummary({ summaryType: 'node', summaryTarget: 'mynode' });
    const updatedState = graphDataState(undefined, action);

    expect(updatedState.summaryData).toEqual({ summaryType: 'node', summaryTarget: 'mynode' });
  });
});
