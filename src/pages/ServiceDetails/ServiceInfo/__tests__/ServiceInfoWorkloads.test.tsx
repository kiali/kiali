import * as React from 'react';
import { shallow } from 'enzyme';
import ServiceInfoWorkload from '../ServiceInfoWorkload';
import { WorkloadOverview } from '../../../../types/ServiceInfo';

const workloads: WorkloadOverview[] = [
  {
    name: 'reviews-v2',
    type: 'Deployment',
    resourceVersion: '081020181987',
    createdAt: '2018-03-14T10:17:52Z"',
    labels: { app: 'reviews', version: 'v2' }
  },
  {
    name: 'reviews-v3',
    type: 'Deployment',
    resourceVersion: '081020181987',
    createdAt: '2018-03-14T10:17:52Z"',
    labels: { app: 'reviews', version: 'v3' }
  },
  {
    name: 'reviews-v1',
    type: 'Deployment',
    resourceVersion: '081020181987',
    createdAt: '2018-03-14T10:17:52Z"',
    labels: { app: 'reviews', version: 'v1' }
  }
];

describe('#ServiceInfoWorkload render correctly with data', () => {
  it('should render service pods', () => {
    const wrapper = shallow(<ServiceInfoWorkload workloads={workloads} namespace={'ns'} />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
