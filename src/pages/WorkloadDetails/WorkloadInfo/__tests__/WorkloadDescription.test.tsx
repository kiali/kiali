import * as React from 'react';
import { shallow, mount } from 'enzyme';
import WorkloadDescription from '../WorkloadDescription';
import { emptyWorkload } from '../../../../types/Workload';
import GraphDataSource from '../../../../services/GraphDataSource';

describe('WorkloadDescription', () => {
  it('should render with runtimes', () => {
    const miniGraphDS = new GraphDataSource();
    const workload = {
      ...emptyWorkload,
      runtimes: [
        {
          name: 'Vert.x',
          dashboardRefs: []
        },
        {
          name: '42',
          dashboardRefs: []
        }
      ]
    };
    const wrapper = shallow(
      <WorkloadDescription
        workload={workload}
        namespace={'my-namespace'}
        istioEnabled={false}
        miniGraphDataSource={miniGraphDS}
      />
    );
    expect(wrapper).toBeDefined();
    // expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('should render with additional details', () => {
    const miniGraphDS = new GraphDataSource();
    const workload = {
      ...emptyWorkload,
      additionalDetails: [
        {
          title: 'SHA-256',
          value: '2a1525fff0cc8e1dfee38ab6f41e57effa2051d7'
        },
        {
          title: 'URL',
          value: 'https://my-service.com'
        }
      ]
    };
    const wrapper = mount(
      <WorkloadDescription
        workload={workload}
        namespace={'my-namespace'}
        istioEnabled={false}
        miniGraphDataSource={miniGraphDS}
      />
    );
    expect(wrapper.find('a').getElements()[0].props.href).toEqual('https://my-service.com');
  });
});
