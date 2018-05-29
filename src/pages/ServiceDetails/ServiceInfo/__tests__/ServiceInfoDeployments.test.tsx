import * as React from 'react';
import { shallow } from 'enzyme';
import ServiceInfoDeployments from '../ServiceInfoDeployments';
import { Deployment } from '../../../../types/ServiceInfo';

const deployments: Deployment[] = [
  {
    name: 'reviews-v2',
    labels: { app: 'reviews', version: 'v2' },
    createdAt: '2018-03-14T10:17:52Z',
    resourceVersion: '1234',
    replicas: 5,
    availableReplicas: 3,
    unavailableReplicas: 2,
    autoscaler: {
      name: 'reviews-v2-autoscaler',
      minReplicas: 2,
      maxReplicas: 10,
      targetCPUUtilizationPercentage: 50
    }
  },
  {
    name: 'reviews-v3',
    labels: { app: 'reviews', version: 'v3' },
    createdAt: '2018-03-14T10:17:52Z',
    resourceVersion: '1234',
    replicas: 2,
    availableReplicas: 2,
    unavailableReplicas: 0,
    autoscaler: {
      name: 'reviews-v2-autoscaler',
      minReplicas: 2,
      maxReplicas: 10,
      targetCPUUtilizationPercentage: 50
    }
  },
  {
    name: 'reviews-v1',
    labels: { app: 'reviews', version: 'v1' },
    createdAt: '2018-03-14T10:17:52Z',
    resourceVersion: '1234',
    replicas: 1,
    availableReplicas: 1,
    unavailableReplicas: 0,
    autoscaler: {
      name: 'reviews-v2-autoscaler',
      minReplicas: 2,
      maxReplicas: 10,
      targetCPUUtilizationPercentage: 50
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
