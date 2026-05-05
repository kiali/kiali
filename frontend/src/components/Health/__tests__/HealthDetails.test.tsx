import * as React from 'react';
import { render } from '@testing-library/react';

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

    const { container } = render(<HealthDetails health={health} />);
    expect(container).toMatchSnapshot();
  });

  it('renders deployments failure', () => {
    const health = new ServiceHealth(
      'bookinfo',
      'reviews',
      { inbound: { http: { '500': 1 } }, outbound: { http: { '500': 1 } }, healthAnnotations: {} },
      { rateInterval: 60, hasSidecar: true, hasAmbient: false }
    );

    const { container } = render(<HealthDetails health={health} />);
    expect(container).toMatchSnapshot();
  });
});
