import * as React from 'react';
import { shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';

import { HealthDetails } from '../HealthDetails';
import { ServiceHealth } from '../../../types/Health';
import { setServerConfig } from '../../../config/ServerConfig';
import { serverRateConfig } from '../../../types/ErrorRate/__testData__/ErrorRateConfig';

describe('HealthDetails', () => {
  beforeAll(() => {
    setServerConfig(serverRateConfig);
  });
  it('renders healthy', () => {
    const health = new ServiceHealth(
      'bookinfo',
      'reviews',
      { inbound: { http: { '200': 1 } }, outbound: { http: { '200': 1 } }, healthAnnotations: {} },
      { rateInterval: 60, hasSidecar: true, hasAmbient: false }
    );

    const wrapper = shallow(<HealthDetails health={health} />);
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('renders deployments failure', () => {
    const health = new ServiceHealth(
      'bookinfo',
      'reviews',
      { inbound: { http: { '500': 1 } }, outbound: { http: { '500': 1 } }, healthAnnotations: {} },
      { rateInterval: 60, hasSidecar: true, hasAmbient: false }
    );

    const wrapper = shallow(<HealthDetails health={health} />);
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });
});
