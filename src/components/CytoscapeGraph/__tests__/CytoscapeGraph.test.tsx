import * as React from 'react';
import { shallow } from 'enzyme';

import { CytoscapeGraph } from '../CytoscapeGraph';
import * as GRAPH_DATA from '../../../services/__mockData__/getGraphElements';
import { Layout, EdgeLabelMode } from '../../../types/GraphFilter';
import EmptyGraphLayout from '../../../containers/EmptyGraphLayoutContainer';
import { GraphType } from '../../../types/Graph';

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
  it('should set correct elements data', () => {
    const myLayout: Layout = { name: 'breadthfirst' };
    const myEdgeLabelMode: EdgeLabelMode = EdgeLabelMode.HIDE;

    const wrapper = shallow(
      <CytoscapeGraph
        activeNamespace={{ name: testNamespace }}
        duration={60}
        edgeLabelMode={myEdgeLabelMode}
        elements={GRAPH_DATA[testNamespace].elements}
        graphLayout={myLayout}
        onClick={testClickHandler}
        onReady={testReadyHandler}
        refresh={testClickHandler}
        setActiveNamespace={testSetHandler}
        showCircuitBreakers={false}
        showMissingSidecars={true}
        showNodeLabels={true}
        showSecurity={true}
        showServiceNodes={false}
        showTrafficAnimation={false}
        showUnusedNodes={false}
        showVirtualServices={true}
        isLoading={false}
        isError={false}
        graphType={GraphType.VERSIONED_APP}
        injectServiceNodes={false}
      />
    );
    const emptyGraphLayoutWrapper = wrapper.find(EmptyGraphLayout);
    expect(emptyGraphLayoutWrapper.prop('elements')['nodes']).toEqual(GRAPH_DATA[testNamespace].elements.nodes);
    expect(emptyGraphLayoutWrapper.prop('elements')['edges']).toEqual(GRAPH_DATA[testNamespace].elements.edges);
  });
});
