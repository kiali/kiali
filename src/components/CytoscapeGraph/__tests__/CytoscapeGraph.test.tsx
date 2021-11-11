import * as React from 'react';
import { shallow } from 'enzyme';

import CytoscapeGraph from '../CytoscapeGraph';
import * as GRAPH_DATA from '../../../services/__mockData__/getGraphElements';
import { DefaultTrafficRates, EdgeLabelMode, GraphType, Layout } from '../../../types/Graph';
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
    const myEdgeLabelMode: EdgeLabelMode[] = [];

    const dataSource = new GraphDataSource();
    dataSource.fetchGraphData({
      includeHealth: false,
      injectServiceNodes: true,
      graphType: GraphType.VERSIONED_APP,
      namespaces: [{ name: testNamespace }],
      duration: 60,
      edgeLabels: myEdgeLabelMode,
      queryTime: 0,
      showIdleEdges: false,
      showIdleNodes: false,
      showOperationNodes: false,
      showSecurity: true,
      trafficRates: DefaultTrafficRates
    });

    dataSource.on('fetchSuccess', () => {
      const wrapper = shallow(
        <CytoscapeGraph
          compressOnHide={true}
          edgeLabels={myEdgeLabelMode}
          graphData={{
            elements: dataSource.graphData,
            isLoading: false,
            fetchParams: {
              includeHealth: false,
              injectServiceNodes: true,
              graphType: GraphType.VERSIONED_APP,
              namespaces: [{ name: testNamespace }],
              duration: 60,
              edgeLabels: myEdgeLabelMode,
              queryTime: 0,
              showIdleEdges: false,
              showIdleNodes: false,
              showOperationNodes: false,
              showSecurity: true,
              trafficRates: DefaultTrafficRates
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
          rank={false}
          rankBy={[]}
          showIdleEdges={false}
          showIdleNodes={false}
          showMissingSidecars={true}
          showOperationNodes={false}
          showSecurity={true}
          showServiceNodes={true}
          showTrafficAnimation={false}
          showVirtualServices={true}
          toggleIdleNodes={() => undefined}
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
