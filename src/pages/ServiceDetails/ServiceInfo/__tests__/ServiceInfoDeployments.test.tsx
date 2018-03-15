import * as React from 'react';
import { shallow } from 'enzyme';
import { ServiceInfoDeployments } from '../index';
import { Deployment } from '../../../../types/ServiceInfo';

const deployments: Deployment[] = [
  {
    name: 'reviews-v2',
    labels: new Map([['app', 'reviews'], ['version', 'v2']]),
    created_at: '2018-03-14T10:17:52Z',
    replicas: 5,
    available_replicas: 3,
    unavailable_replicas: 2,
    autoscaler: {
      name: 'reviews-v2-autoscaler',
      min_replicas: 2,
      max_replicas: 10,
      target_cpu_utilization_percentage: 50
    }
  },
  {
    name: 'reviews-v3',
    labels: new Map([['app', 'reviews'], ['version', 'v3']]),
    created_at: '2018-03-14T10:17:52Z',
    replicas: 2,
    available_replicas: 2,
    unavailable_replicas: 0,
    autoscaler: {
      name: 'reviews-v2-autoscaler',
      min_replicas: 2,
      max_replicas: 10,
      target_cpu_utilization_percentage: 50
    }
  },
  {
    name: 'reviews-v1',
    labels: new Map([['app', 'reviews'], ['version', 'v1']]),
    created_at: '2018-03-14T10:17:52Z',
    replicas: 1,
    available_replicas: 1,
    unavailable_replicas: 0,
    autoscaler: {
      name: 'reviews-v2-autoscaler',
      min_replicas: 2,
      max_replicas: 10,
      target_cpu_utilization_percentage: 50
    }
  }
];

describe('#ServiceInfoDeployments render correctly with data', () => {
  it('should render service pods', () => {
    const wrapper = shallow(<ServiceInfoDeployments deployments={deployments} />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
