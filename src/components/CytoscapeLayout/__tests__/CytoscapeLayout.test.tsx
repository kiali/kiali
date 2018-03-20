import * as React from 'react';
import { shallow } from 'enzyme';
import { Button } from 'patternfly-react';

import { ColaGraph } from '../graphs/ColaGraph';
import CytoscapeLayout from '../CytoscapeLayout';
import * as GRAPH_DATA from '../../../services/__mockData__/getGraphElements';

jest.mock('../../../services/Api');

jest.useFakeTimers();

const testNamespace = 'ISTIO_SYSTEM';
const testHandler = () => {
  console.log('click');
};

describe('CytographLayout component test', () => {
  it('should set correct elements data', async () => {
    const wrapper = await shallow(
      <CytoscapeLayout namespace={testNamespace} layout={ColaGraph.getLayout()} interval="30s" onClick={testHandler} />
    );
    wrapper.update();
    expect(wrapper.instance().state.elements.nodes).toEqual(GRAPH_DATA[testNamespace].elements.nodes);
    expect(wrapper.instance().state.elements.edges).toEqual(GRAPH_DATA[testNamespace].elements.edges);
  });

  it('should refresh data on click', () => {
    // for spy to work updateGraphElements() must be regular function, not fat arrow =>
    // see https://github.com/airbnb/enzyme/issues/944
    const spyUpdateGraphElements = jest.spyOn(CytoscapeLayout.prototype, 'updateGraphElements');

    const wrapper = shallow(
      <CytoscapeLayout namespace={testNamespace} layout={ColaGraph.getLayout()} interval="30s" onClick={testHandler} />
    );
    expect(spyUpdateGraphElements).toHaveBeenCalledTimes(1);
    const buttonWrapper = wrapper.find(Button);
    buttonWrapper.simulate('click');
    expect(spyUpdateGraphElements).toHaveBeenCalledTimes(2);
  });
});
