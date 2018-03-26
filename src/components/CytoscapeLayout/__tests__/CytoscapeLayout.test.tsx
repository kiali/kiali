import * as React from 'react';
import { shallow } from 'enzyme';

import ReactCytoscape from '../ReactCytoscape';
import CytoscapeLayout from '../CytoscapeLayout';
import * as GRAPH_DATA from '../../../services/__mockData__/getGraphElements';
import { Duration, Layout } from '../../../types/GraphFilter';

jest.mock('../../../services/Api');

const testNamespace = 'ISTIO_SYSTEM';

const testHandler = () => {
  console.log('click');
};

describe('CytographLayout component test', () => {
  it('should set correct elements data', () => {
    const myLayout: Layout = { name: 'breadthfirst' };
    const myDuration: Duration = { value: '5m' };

    const wrapper = shallow(
      <CytoscapeLayout
        namespace={{ name: testNamespace }}
        elements={GRAPH_DATA[testNamespace]}
        graphLayout={myLayout}
        graphDuration={myDuration}
        onClick={testHandler}
      />
    );
    const cytoscapeWrapper = wrapper.find(ReactCytoscape);
    expect(cytoscapeWrapper.prop('elements').elements.nodes).toEqual(GRAPH_DATA[testNamespace].elements.nodes);
    expect(cytoscapeWrapper.prop('elements').elements.edges).toEqual(GRAPH_DATA[testNamespace].elements.edges);
  });
});
