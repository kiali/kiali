import * as React from 'react';
import { shallow } from 'enzyme';
import { ServiceInfoDescription } from '../index';

const labels: Map<string, string> = new Map([['app', 'reviews']]);

const endpoints = [
  {
    addresses: [
      {
        kind: 'Pod',
        name: 'reviews-v2-4140793682-qrpm9',
        ip: '172.17.0.11'
      },
      {
        kind: 'Pod',
        name: 'reviews-v3-3651831602-zn9g6',
        ip: '172.17.0.14'
      },
      {
        kind: 'Pod',
        name: 'reviews-v1-401049526-tfstp',
        ip: '172.17.0.16'
      }
    ],
    ports: [
      {
        name: 'http',
        protocol: 'TCP',
        port: 9080
      }
    ]
  }
];

describe('#ServiceInfoDescription render correctly with data', () => {
  it('should render service description', () => {
    const wrapper = shallow(
      <ServiceInfoDescription name="reviews" labels={labels} type="ClusterIP" ip="172.30.78.33" endpoints={endpoints} />
    );
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
