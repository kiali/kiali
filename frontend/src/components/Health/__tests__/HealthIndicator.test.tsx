import * as React from 'react';
import { render } from '@testing-library/react';

import { HealthIndicator } from '../HealthIndicator';
import { AppHealth, DEGRADED, FAILURE, HEALTHY, NOT_READY } from '../../../types/Health';
import { setServerConfig } from '../../../config/ServerConfig';
import { healthConfig } from '../../../types/__testData__/HealthConfig';
import { createIcon } from 'config/KialiIcon';

const getIconHtml = (icon: React.ReactElement): string => {
  const { container } = render(icon);
  return container.innerHTML;
};

describe('HealthIndicator', () => {
  beforeAll(() => {
    setServerConfig(healthConfig);
  });
  it('renders when empty', () => {
    // SMALL
    const { container: containerSmall } = render(<HealthIndicator id="svc" />);
    expect(containerSmall.innerHTML).not.toContain('pf-v6-pficon');

    // LARGE
    const { container: containerLarge } = render(<HealthIndicator id="svc" />);
    expect(containerLarge.innerHTML).not.toContain('pf-v6-pficon');
  });

  it('renders healthy', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [
        { name: 'A', availableReplicas: 1, currentReplicas: 1, desiredReplicas: 1, syncedProxies: 1 },
        { name: 'B', availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2, syncedProxies: 2 }
      ],
      { inbound: {}, outbound: {}, healthAnnotations: {} },
      { rateInterval: 300, hasSidecar: true, hasAmbient: false },
      { status: 'Healthy' }
    );

    const { container } = render(<HealthIndicator id="svc" health={health} />);
    expect(container).toMatchSnapshot();
    const html = container.innerHTML;
    expect(html).toContain(getIconHtml(createIcon(HEALTHY)));
  });

  it('renders workloads degraded', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [
        { name: 'A', availableReplicas: 1, currentReplicas: 1, desiredReplicas: 10, syncedProxies: 1 },
        { name: 'B', availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2, syncedProxies: 2 }
      ],
      { inbound: {}, outbound: {}, healthAnnotations: {} },
      { rateInterval: 300, hasSidecar: true, hasAmbient: false },
      { status: 'Degraded' }
    );

    const { container } = render(<HealthIndicator id="svc" health={health} />);
    const html = container.innerHTML;
    expect(html).toContain(getIconHtml(createIcon(DEGRADED)));
  });

  it('renders some scaled down workload', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [
        { name: 'A', availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0, syncedProxies: 0 },
        { name: 'B', availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2, syncedProxies: 2 }
      ],
      { inbound: {}, outbound: {}, healthAnnotations: {} },
      { rateInterval: 300, hasSidecar: true, hasAmbient: false },
      { status: 'Not Ready' }
    );

    const { container } = render(<HealthIndicator id="svc" health={health} />);
    const html = container.innerHTML;
    expect(html).toContain(getIconHtml(createIcon(NOT_READY)));
  });

  it('renders all workloads down', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [
        { name: 'A', availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0, syncedProxies: 0 },
        { name: 'B', availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0, syncedProxies: 0 }
      ],
      { inbound: {}, outbound: {}, healthAnnotations: {} },
      { rateInterval: 300, hasSidecar: true, hasAmbient: false },
      { status: 'Not Ready' }
    );

    const { container } = render(<HealthIndicator id="svc" health={health} />);
    const html = container.innerHTML;
    expect(html).toContain(getIconHtml(createIcon(NOT_READY)));
  });

  it('renders error rate failure', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [{ name: 'A', availableReplicas: 1, currentReplicas: 1, desiredReplicas: 1, syncedProxies: 1 }],
      {
        inbound: { http: { '200': 0.5, '500': 0.5 } },
        outbound: { http: { '500': 0.4, '200': 2 } },
        healthAnnotations: {}
      },
      { rateInterval: 300, hasSidecar: true, hasAmbient: false },
      { status: 'Failure' }
    );

    const { container } = render(<HealthIndicator id="svc" health={health} />);
    const html = container.innerHTML;
    expect(html).toContain(getIconHtml(createIcon(FAILURE)));
  });

  describe('proxy status section', () => {
    it('renders the degraded workloads', () => {
      const health = new AppHealth(
        'bookinfo',
        'reviews',
        [
          {
            name: 'A',
            availableReplicas: 2,
            currentReplicas: 2,
            desiredReplicas: 2,
            syncedProxies: 1
          }
        ],
        { inbound: {}, outbound: {}, healthAnnotations: {} },
        { rateInterval: 300, hasSidecar: true, hasAmbient: false },
        { status: 'Degraded' }
      );

      const { container } = render(<HealthIndicator id="svc" health={health} />);
      const html = container.innerHTML;
      expect(html).toContain(getIconHtml(createIcon(DEGRADED)));
      expect(container).toMatchSnapshot();
    });
  });
});
