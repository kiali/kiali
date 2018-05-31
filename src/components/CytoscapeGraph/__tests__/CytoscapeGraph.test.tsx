import * as React from 'react';
import { shallow } from 'enzyme';

import { CytoscapeGraph } from '../CytoscapeGraph';
import * as GRAPH_DATA from '../../../services/__mockData__/getGraphElements';
import { Duration, Layout, EdgeLabelMode, PollInterval } from '../../../types/GraphFilter';
import { CytoscapeReactWrapper } from '../CytoscapeReactWrapper';

jest.mock('../../../services/Api');

const testNamespace = 'ISTIO_SYSTEM';

const testClickHandler = () => {
  console.log('click');
};

const testReadyHandler = () => {
  console.log('ready');
};

describe('CytoscapeGraph component test', () => {
  it('should set correct elements data', () => {
    const myLayout: Layout = { name: 'breadthfirst' };
    const myDuration: Duration = { value: 300 };
    const myPollInterval: PollInterval = { value: 5 };
    const myEdgeLabelMode: EdgeLabelMode = EdgeLabelMode.HIDE;

    const wrapper = shallow(
      <CytoscapeGraph
        namespace={{ name: testNamespace }}
        elements={GRAPH_DATA[testNamespace]}
        graphLayout={myLayout}
        graphDuration={myDuration}
        edgeLabelMode={myEdgeLabelMode}
        pollInterval={myPollInterval}
        onClick={testClickHandler}
        onReady={testReadyHandler}
        refresh={testClickHandler}
        showNodeLabels={true}
        showCircuitBreakers={false}
        showRouteRules={true}
        showMissingSidecars={true}
        showTrafficAnimation={false}
      />
    );
    const cytoscapeWrapper = wrapper.find(CytoscapeReactWrapper);
    expect(cytoscapeWrapper.prop('elements')['elements'].nodes).toEqual(GRAPH_DATA[testNamespace].elements.nodes);
    expect(cytoscapeWrapper.prop('elements')['elements'].edges).toEqual(GRAPH_DATA[testNamespace].elements.edges);
  });
});
