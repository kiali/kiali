import * as React from 'react';
import { shallow } from 'enzyme';
import OverviewCardLinks from '../OverviewCardLinks';
import { Tooltip } from '@patternfly/react-core';

describe('Overview page card links', () => {
  it('does not render link to apps list when overview type is app', () => {
    const wrapper = shallow(<OverviewCardLinks name="bookinfo" overviewType="app" />);

    const tooltips = wrapper.find(Tooltip);
    const keys = tooltips.map(node => node.key()).join();

    expect(keys).toBe('ot_graph,ot_workloads,ot_services,ot_istio');
  });

  it('does not render link to workloads list when overview type is workload', () => {
    const wrapper = shallow(<OverviewCardLinks name="bookinfo" overviewType="workload" />);

    const tooltips = wrapper.find(Tooltip);
    const keys = tooltips.map(node => node.key()).join();

    expect(keys).toBe('ot_graph,ot_apps,ot_services,ot_istio');
  });

  it('does not render link to services list when overview type is service', () => {
    const wrapper = shallow(<OverviewCardLinks name="bookinfo" overviewType="service" />);

    const tooltips = wrapper.find(Tooltip);
    const keys = tooltips.map(node => node.key()).join();

    expect(keys).toBe('ot_graph,ot_apps,ot_workloads,ot_istio');
  });
});
