import graphDataState from '../GraphDataState';
import { GraphActions } from '../../actions/GraphActions';
import { GlobalActions } from '../../actions/GlobalActions';
import { EdgeLabelMode, GraphType } from '../../types/Graph';
import { DagreGraph } from '../../components/CytoscapeGraph/graphs/DagreGraph';

describe('GraphDataState', () => {
  it('should return the initial state', () => {
    expect(graphDataState(undefined, GlobalActions.unknown())).toEqual({
      layout: DagreGraph.getLayout(),
      node: undefined,
      summaryData: null,
      toolbarState: {
        compressOnHide: true,
        edgeLabelMode: EdgeLabelMode.NONE,
        findValue: '',
        graphType: GraphType.VERSIONED_APP,
        hideValue: '',
        showCircuitBreakers: true,
        showFindHelp: false,
        showLegend: false,
        showMissingSidecars: true,
        showNodeLabels: true,
        showSecurity: false,
        showServiceNodes: true,
        showTrafficAnimation: false,
        showUnusedNodes: false,
        showVirtualServices: true
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
