import * as React from 'react';
import { shallow } from 'enzyme';

import { CytoscapeGraph } from '../CytoscapeGraph';
import * as GRAPH_DATA from '../../../services/__mockData__/getGraphElements';
import { Duration, Layout, EdgeLabelMode } from '../../../types/GraphFilter';
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

const testDoubleClickHandler = () => {
  console.log('double click');
};

describe('CytoscapeGraph component test', () => {
  it('should set correct elements data', () => {
    const myLayout: Layout = { name: 'breadthfirst' };
    const myDuration: Duration = { value: 300 };
    const myEdgeLabelMode: EdgeLabelMode = EdgeLabelMode.HIDE;

    const wrapper = shallow(
      <CytoscapeGraph
        namespace={{ name: testNamespace }}
        elements={GRAPH_DATA[testNamespace].elements}
        graphLayout={myLayout}
        graphDuration={myDuration}
        edgeLabelMode={myEdgeLabelMode}
        onClick={testClickHandler}
        onDoubleClick={testDoubleClickHandler}
        onReady={testReadyHandler}
        refresh={testClickHandler}
        showNodeLabels={true}
        showCircuitBreakers={false}
        showVirtualServices={true}
        showMissingSidecars={true}
        showServiceNodes={false}
        showTrafficAnimation={false}
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
