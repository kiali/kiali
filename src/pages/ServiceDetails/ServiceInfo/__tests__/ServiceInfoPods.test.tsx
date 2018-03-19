import * as React from 'react';
import { shallow } from 'enzyme';
import { ServiceInfoPods } from '../index';
import { Pod } from '../../../../types/ServiceInfo';

const pods: Pod[] = [
  {
    name: 'reviews-v2-4140793682-qrpm9',
    labels: new Map([['app', 'reviews'], ['pod-template-hash', '4140793682'], ['version', 'v2']])
  },
  {
    name: 'reviews-v3-3651831602-zn9g6',
    labels: new Map([['app', 'reviews'], ['pod-template-hash', '3651831602'], ['version', 'v3']])
  },
  {
    name: 'reviews-v1-401049526-tfstp',
    labels: new Map([['app', 'reviews'], ['pod-template-hash', '401049526'], ['version', 'v1']])
  }
];

describe('#ServiceInfoPods render correctly with data', () => {
  it('should render service pods', () => {
    const wrapper = shallow(<ServiceInfoPods pods={pods} />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
