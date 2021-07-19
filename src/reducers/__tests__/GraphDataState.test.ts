import graphDataState from '../GraphDataState';
import { GraphActions } from '../../actions/GraphActions';
import { GlobalActions } from '../../actions/GlobalActions';
import { DefaultTrafficRates, GraphType } from '../../types/Graph';
import { DagreGraph } from '../../components/CytoscapeGraph/graphs/DagreGraph';

describe('GraphDataState', () => {
  it('should return the initial state', () => {
    expect(graphDataState(undefined, GlobalActions.unknown())).toEqual({
      graphDefinition: null,
      layout: DagreGraph.getLayout(),
      node: undefined,
      summaryData: null,
      toolbarState: {
        boxByCluster: false,
        boxByNamespace: false,
        compressOnHide: true,
        edgeLabels: [],
        findValue: '',
        graphType: GraphType.VERSIONED_APP,
        hideValue: '',
        showFindHelp: false,
        showLegend: false,
        showIdleEdges: false,
        showIdleNodes: false,
        showMissingSidecars: true,
        showOperationNodes: false,
        showSecurity: false,
        showServiceNodes: true,
        showTrafficAnimation: false,
        showVirtualServices: true,
        trafficRates: DefaultTrafficRates
      },
      updateTime: 0
    });
  });

  it('should handle UPDATE_SUMMARY', () => {
    const action = GraphActions.updateSummary({ summaryType: 'node', summaryTarget: 'mynode' });
    const updatedState = graphDataState(undefined, action);

    expect(updatedState.summaryData).toEqual({ summaryType: 'node', summaryTarget: 'mynode' });
  });
});
