import * as React from 'react';
import { shallow } from 'enzyme';

import { ColaGraph } from '../graphs/ColaGraph';
import CytoscapeLayout from '../CytoscapeLayout';
import { refreshSettings } from '../../../model/RefreshSettings';
import * as GRAPH_DATA from '../../../services/__mockData__/getGraphElements';

jest.mock('../../../services/Api');

jest.useFakeTimers();

const testNamespace = 'ISTIO_SYSTEM';

describe('CytographLayout component test', () => {
  it('should set correct elements data', async () => {
    const wrapper = await shallow(
      <CytoscapeLayout namespace={testNamespace} layout={ColaGraph.getLayout()} interval="30s" />
    );
    wrapper.update();
    expect(wrapper.instance().state.elements.nodes).toEqual(GRAPH_DATA[testNamespace].elements.nodes);
    expect(wrapper.instance().state.elements.edges).toEqual(GRAPH_DATA[testNamespace].elements.edges);
  });

  it('should auto-refresh after an interval', () => {
    // for spy to work updateGraphElements() must be regular function, not fat arrow =>
    // see https://github.com/airbnb/enzyme/issues/944
    const spyUpdateGraphElements = jest.spyOn(CytoscapeLayout.prototype, 'updateGraphElements');

    shallow(<CytoscapeLayout namespace={testNamespace} layout={ColaGraph.getLayout()} interval="30s" />);
    expect(spyUpdateGraphElements).toHaveBeenCalledTimes(1);

    jest.runTimersToTime(refreshSettings.interval + 1000);
    expect(spyUpdateGraphElements).toHaveBeenCalledTimes(2);
  });
});
