import * as React from 'react';
import { shallow } from 'enzyme';

import { GraphParamsType, GraphType } from '../../../types/Graph';
import { Duration, EdgeLabelMode } from '../../../types/GraphFilter';

import GraphFilterToolbar from '../GraphFilterToolbar';

const PARAMS: GraphParamsType = {
  graphDuration: { value: 60 },
  graphLayout: { name: 'Cose' },
  edgeLabelMode: EdgeLabelMode.HIDE,
  graphType: GraphType.VERSIONED_APP,
  injectServiceNodes: false
};

describe('GraphPage test', () => {
  it('should propagate filter params change with correct value', () => {
    const onParamsChangeMockFn = jest.fn();
    const wrapper = shallow(
      <GraphFilterToolbar
        {...PARAMS}
        showSecurity={true}
        showUnusedNodes={false}
        isLoading={false}
        handleRefreshClick={jest.fn()}
      />
    );

    const toolbar = wrapper.instance() as GraphFilterToolbar;
    toolbar.handleFilterChange = onParamsChangeMockFn;

    const newDuration: Duration = { value: 1800 };
    toolbar.handleDurationChange(newDuration); // simulate duration change
    const EXPECT2 = Object.assign({}, PARAMS, { graphDuration: newDuration });
    expect(onParamsChangeMockFn).toHaveBeenLastCalledWith(EXPECT2);
  });
});
