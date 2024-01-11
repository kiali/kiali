import * as React from 'react';
import { shallow } from 'enzyme';

import { CytoscapeGraph } from '../CytoscapeGraph';
import * as GRAPH_DATA from '../../../services/__mockData__/getGraphElements';
import { DefaultTrafficRates, EdgeLabelMode, EdgeMode, GraphType, Layout } from '../../../types/Graph';
import { EmptyGraphLayout } from '../EmptyGraphLayout';
import { decorateGraphData } from '../../../store/Selectors/GraphData';
import { GraphDataSource } from '../../../services/GraphDataSource';
import { toSafeCyFieldName } from '../CytoscapeGraphUtils';
import { Theme } from 'types/Common';

jest.mock('../../../services/Api');

const testNamespace = 'ISTIO_SYSTEM';

const testClickHandler = (): void => {
  console.log('click');
};

const testReadyHandler = (): void => {
  console.log('ready');
};

const testSetHandler = (): void => {
  console.log('set');
};

describe('CytoscapeGraph component test', () => {
  it('should set correct elements data', done => {
    const myLayout: Layout = { name: 'breadthfirst' };
    const nsLayout: Layout = { name: 'kiali-dagre' };
    const myEdgeLabelMode: EdgeLabelMode[] = [];

    const dataSource = new GraphDataSource();
    dataSource.fetchGraphData({
      duration: 60,
      edgeLabels: myEdgeLabelMode,
      graphType: GraphType.VERSIONED_APP,
      includeHealth: false,
      includeLabels: false,
      injectServiceNodes: true,
      namespaces: [{ name: testNamespace }],
      queryTime: 0,
      showIdleEdges: false,
      showIdleNodes: false,
      showOperationNodes: false,
      showSecurity: true,
      showWaypoints: false,
      trafficRates: DefaultTrafficRates
    });

    dataSource.on('fetchSuccess', () => {
      const wrapper = shallow(
        <CytoscapeGraph
          compressOnHide={true}
          edgeLabels={myEdgeLabelMode}
          edgeMode={EdgeMode.ALL}
          graphData={{
            elements: dataSource.graphData,
            elementsChanged: true,
            isLoading: false,
            fetchParams: {
              duration: 60,
              edgeLabels: myEdgeLabelMode,
              graphType: GraphType.VERSIONED_APP,
              includeHealth: false,
              includeLabels: false,
              injectServiceNodes: true,
              namespaces: [{ name: testNamespace }],
              queryTime: 0,
              showIdleEdges: false,
              showIdleNodes: false,
              showOperationNodes: false,
              showSecurity: true,
              showWaypoints: false,
              trafficRates: DefaultTrafficRates
            },
            timestamp: 0
          }}
          layout={myLayout}
          namespaceLayout={nsLayout}
          updateSummary={testClickHandler}
          onReady={testReadyHandler}
          onEmptyGraphAction={testClickHandler}
          refreshInterval={0}
          setActiveNamespaces={testSetHandler}
          setNode={testSetHandler}
          rankBy={[]}
          showIdleEdges={false}
          showIdleNodes={false}
          showOutOfMesh={true}
          showOperationNodes={false}
          showRank={false}
          showSecurity={true}
          showServiceNodes={true}
          showTrafficAnimation={false}
          showVirtualServices={true}
          summaryData={null}
          toggleIdleNodes={() => undefined}
          theme={Theme.LIGHT}
        />
      );

      const emptyGraphLayoutWrapper = wrapper.find(EmptyGraphLayout);
      const emptyGraphDecorated = decorateGraphData(GRAPH_DATA[testNamespace].elements, 60);
      expect(emptyGraphLayoutWrapper.prop('elements')!.nodes).toEqual(emptyGraphDecorated.nodes);
      expect(emptyGraphLayoutWrapper.prop('elements')!.edges).toEqual(emptyGraphDecorated.edges);

      done();
    });
  });

  describe('utils test', () => {
    it('should have working utils', done => {
      expect(toSafeCyFieldName('foo')).toEqual('foo');
      expect(toSafeCyFieldName('label_foo')).toEqual('label_foo');
      expect(toSafeCyFieldName('label:kiali.io/foo')).toEqual('label_kiali_io_foo');

      done();
    });
  });
});
