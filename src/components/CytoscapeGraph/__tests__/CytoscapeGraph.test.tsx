import * as React from 'react';
import { shallow } from 'enzyme';

import CytoscapeGraph from '../CytoscapeGraph';
import * as GRAPH_DATA from '../../../services/__mockData__/getGraphElements';
import { EdgeLabelMode, GraphType, Layout } from '../../../types/Graph';
import EmptyGraphLayoutContainer from '../EmptyGraphLayout';
import { decorateGraphData } from '../../../store/Selectors/GraphData';
import GraphDataSource from '../../../services/GraphDataSource';

jest.mock('../../../services/Api');

const testNamespace = 'ISTIO_SYSTEM';

const testClickHandler = () => {
  console.log('click');
};

const testReadyHandler = () => {
  console.log('ready');
};

const testSetHandler = () => {
  console.log('set');
};

describe('CytoscapeGraph component test', () => {
  it('should set correct elements data', done => {
    const myLayout: Layout = { name: 'breadthfirst' };
    const myEdgeLabelMode: EdgeLabelMode = EdgeLabelMode.NONE;

    const dataSource = new GraphDataSource();
    dataSource.fetchGraphData({
      includeHealth: false,
      injectServiceNodes: true,
      graphType: GraphType.VERSIONED_APP,
      namespaces: [{ name: testNamespace }],
      duration: 60,
      edgeLabelMode: myEdgeLabelMode,
      queryTime: 0,
      showOperationNodes: false,
      showSecurity: true,
      showUnusedNodes: false
    });

    dataSource.on('fetchSuccess', () => {
      const wrapper = shallow(
        <CytoscapeGraph
          compressOnHide={true}
          edgeLabelMode={myEdgeLabelMode}
          graphData={{
            elements: dataSource.graphData,
            isLoading: false,
            fetchParams: {
              includeHealth: false,
              injectServiceNodes: true,
              graphType: GraphType.VERSIONED_APP,
              namespaces: [{ name: testNamespace }],
              duration: 60,
              edgeLabelMode: myEdgeLabelMode,
              queryTime: 0,
              showOperationNodes: false,
              showSecurity: true,
              showUnusedNodes: false
            },
            timestamp: 0
          }}
          layout={myLayout}
          updateSummary={testClickHandler}
          onReady={testReadyHandler}
          onEmptyGraphAction={testClickHandler}
          refreshInterval={0}
          setActiveNamespaces={testSetHandler}
          setNode={testSetHandler}
          isMTLSEnabled={false}
          showCircuitBreakers={false}
          showMissingSidecars={true}
          showNodeLabels={true}
          showOperationNodes={false}
          showSecurity={true}
          showServiceNodes={true}
          showTrafficAnimation={false}
          showUnusedNodes={false}
          showVirtualServices={true}
          displayUnusedNodes={() => undefined}
        />
      );

      const emptyGraphLayoutWrapper = wrapper.find(EmptyGraphLayoutContainer);
      const emptyGraphDecorated = decorateGraphData(GRAPH_DATA[testNamespace].elements);
      expect(emptyGraphLayoutWrapper.prop('elements')!.nodes).toEqual(emptyGraphDecorated.nodes);
      expect(emptyGraphLayoutWrapper.prop('elements')!.edges).toEqual(emptyGraphDecorated.edges);

      done();
    });
  });
});
