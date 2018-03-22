import * as React from 'react';
import { shallow } from 'enzyme';
import { ServiceInfoRouteRules } from '../index';
import { RouteRule } from '../../../../types/ServiceInfo';

const rules: RouteRule[] = [
  {
    name: 'reviews-default',
    destination: {
      name: 'reviews'
    },
    precedence: 1,
    route: [
      {
        labels: new Map([['version', 'v1']])
      }
    ],
    match: undefined
  },
  {
    name: 'reviews-test-v2',
    destination: {
      name: 'reviews'
    },
    precedence: 2,
    route: [
      {
        labels: new Map([['version', 'v2']])
      }
    ],
    match: undefined
  }
];

describe('#ServiceInfoRouteRules render correctly with data', () => {
  it('should render service rules', () => {
    const wrapper = shallow(<ServiceInfoRouteRules routeRules={rules} />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
