import * as React from 'react';
import { shallow } from 'enzyme';
import { ServiceInfoRules } from '../index';
import { Rule } from '../../../../types/ServiceInfo';

const rules: Rule[] = [
  {
    name: 'reviews-default',
    destination: new Map([['name', 'reviews']]),
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
    destination: new Map([['name', 'reviews']]),
    precedence: 2,
    route: [
      {
        labels: new Map([['version', 'v2']])
      }
    ],
    match: undefined
  }
];

describe('#ServiceInfoRules render correctly with data', () => {
  it('should render service rules', () => {
    const wrapper = shallow(<ServiceInfoRules rules={rules} />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
