import * as React from 'react';
import { render, waitFor } from '@testing-library/react';
import { serverConfig } from 'config';
import { ServiceWizard } from '../ServiceWizard';
import { ServiceWizardProps, WIZARD_FAULT_INJECTION } from '../WizardActions';

jest.mock('utils/I18nUtils', () => ({
  t: (key: string) => key
}));

jest.mock('../FaultInjection', () => ({
  FaultInjection: () => <div>Fault Injection Content</div>
}));

jest.mock('../RequestRouting', () => ({
  RequestRouting: () => <div>Request Routing Content</div>
}));

jest.mock('../K8sRequestRouting', () => ({
  K8sRequestRouting: () => <div>K8s Request Routing Content</div>
}));

jest.mock('../TrafficShifting', () => ({
  TrafficShifting: () => <div>Traffic Shifting Content</div>
}));

jest.mock('../RequestTimeouts', () => ({
  RequestTimeouts: () => <div>Request Timeouts Content</div>
}));

jest.mock('../GatewaySelector', () => ({
  GatewaySelector: () => <div>Gateway Selector Content</div>
}));

jest.mock('../K8sGatewaySelector', () => ({
  K8sGatewaySelector: () => <div>K8s Gateway Selector Content</div>
}));

jest.mock('../VirtualServiceHosts', () => ({
  VirtualServiceHosts: () => <div>Virtual Service Hosts Content</div>
}));

jest.mock('../K8sRouteHosts', () => ({
  K8sRouteHosts: () => <div>K8s Route Hosts Content</div>
}));

jest.mock('../K8sGRPCRouteHosts', () => ({
  K8sGRPCRouteHosts: () => <div>K8s GRPC Route Hosts Content</div>
}));

jest.mock('../TrafficPolicy', () => ({
  TrafficPolicy: () => <div>Traffic Policy Content</div>,
  ConsistentHashType: {
    HTTP_HEADER_NAME: 'HTTP_HEADER_NAME'
  },
  ROUND_ROBIN: 'ROUND_ROBIN',
  UNSET: 'UNSET'
}));

jest.mock('../CircuitBreaker', () => ({
  CircuitBreaker: () => <div>Circuit Breaker Content</div>
}));

jest.mock('components/IstioConfigPreview/IstioConfigPreview', () => ({
  IstioConfigPreview: () => null
}));

const onClose = jest.fn();

const baseProps: ServiceWizardProps = {
  cluster: 'test-cluster',
  createOrUpdate: true,
  destinationRules: [],
  gateways: [],
  k8sGRPCRoutes: [],
  k8sGateways: [],
  k8sHTTPRoutes: [],
  namespace: 'bookinfo',
  onClose,
  peerAuthentications: [],
  serviceName: 'ratings',
  show: false,
  subServices: [],
  tlsStatus: undefined,
  type: WIZARD_FAULT_INJECTION,
  update: false,
  virtualServices: [],
  workloads: []
};

describe('ServiceWizard', () => {
  const origViewOnly = serverConfig.deployment.viewOnlyMode;
  const getFooter = (): HTMLDivElement | null => document.querySelector('.pf-v6-c-modal-box__footer');

  afterEach(() => {
    serverConfig.deployment.viewOnlyMode = origViewOnly;
    onClose.mockReset();
  });

  it('shows only Close in view-only mode', async () => {
    serverConfig.deployment.viewOnlyMode = true;

    const { rerender } = render(<ServiceWizard {...baseProps} />);
    rerender(<ServiceWizard {...baseProps} show={true} />);

    await waitFor(() => {
      expect(getFooter()).toHaveTextContent('Close');
    });

    expect(getFooter()).not.toHaveTextContent('Create');
    expect(getFooter()).not.toHaveTextContent('Cancel');
    expect(getFooter()?.querySelectorAll('button')).toHaveLength(1);
  });

  it('shows Create and Cancel outside view-only mode', async () => {
    serverConfig.deployment.viewOnlyMode = false;

    const { rerender } = render(<ServiceWizard {...baseProps} />);
    rerender(<ServiceWizard {...baseProps} show={true} />);

    await waitFor(() => {
      expect(getFooter()).toHaveTextContent('Create');
    });

    expect(getFooter()).toHaveTextContent('Cancel');
    expect(getFooter()).not.toHaveTextContent('Close');
    expect(getFooter()?.querySelectorAll('button')).toHaveLength(2);
  });
});
