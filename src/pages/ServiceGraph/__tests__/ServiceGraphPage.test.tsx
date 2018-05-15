import * as React from 'react';
import { shallow } from 'enzyme';

import { GraphParamsType } from '../../../types/Graph';
import { Duration, Layout } from '../../../types/GraphFilter';
import Namespace from '../../../types/Namespace';

import ServiceGraphPage from '../ServiceGraphPage';

const dummyFunction = () => 0;

const PARAMS: GraphParamsType = {
  namespace: { name: 'itsio-system' },
  graphDuration: { value: 60 },
  graphLayout: { name: 'Cose' }
};
describe('ServiceGraphPage test', () => {
  it('should propagate filter params change with correct value', () => {
    const onParamsChangeFn = jest.fn();
    const wrapper = shallow(
      <ServiceGraphPage
        {...PARAMS}
        onParamsChange={onParamsChangeFn}
        fetchGraphData={dummyFunction}
        graphTimestamp={'0'}
        graphData={[]}
        isLoading={false}
      />
    );

    const serviceGraph = wrapper.instance() as ServiceGraphPage;
    const newLayout: Layout = { name: 'Cola' };
    serviceGraph.handleLayoutChange(newLayout); // simulate layout change
    const EXPECT1 = Object.assign({}, PARAMS, { graphLayout: newLayout });
    expect(onParamsChangeFn).toHaveBeenLastCalledWith(EXPECT1);

    const newDuration: Duration = { value: 1800 };
    serviceGraph.handleFilterChange(newDuration); // simulate duration change
    const EXPECT2 = Object.assign({}, PARAMS, { graphDuration: newDuration });
    expect(onParamsChangeFn).toHaveBeenLastCalledWith(EXPECT2);

    const newNamespace: Namespace = { name: 'bookinfo' };
    serviceGraph.handleNamespaceChange(newNamespace); // simulate name change
    const EXPECT3 = Object.assign({}, PARAMS, { namespace: newNamespace });
    expect(onParamsChangeFn).toHaveBeenLastCalledWith(EXPECT3);
  });
});
