import * as React from 'react';
import { shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';

import { HealthDetails } from '../HealthDetails';
import { ServiceHealth } from '../../../types/Health';

describe('HealthDetails', () => {
  it('renders healthy', () => {
    const health = new ServiceHealth(
      { errorRatio: -1, inboundErrorRatio: -1, outboundErrorRatio: -1 },
      { rateInterval: 60, hasSidecar: true }
    );

    const wrapper = shallow(<HealthDetails health={health} />);
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('renders deployments failure', () => {
    const health = new ServiceHealth(
      { errorRatio: -1, inboundErrorRatio: -1, outboundErrorRatio: -1 },
      { rateInterval: 60, hasSidecar: true }
    );

    const wrapper = shallow(<HealthDetails health={health} />);
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });
});
