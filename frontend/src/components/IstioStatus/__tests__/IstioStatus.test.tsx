import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { ComponentStatus, Status } from '../../../types/IstioStatus';
import { IstioStatusComponent, ClusterStatusMap } from '../IstioStatus';
import { CLUSTER_DEFAULT } from '../../../types/Graph';
import { serverConfig } from '../../../config';
import { setServerConfig } from '../../../config/ServerConfig';
import { store } from '../../../store/ConfigStore';
import { MemoryRouter } from 'react-router-dom-v5-compat';

let mockStatusMap: ClusterStatusMap = {};

jest.mock('../../../hooks/clusters', () => ({
  useClusterStatus: () => ({
    isError: false,
    isLoading: false,
    refresh: jest.fn(),
    statusMap: mockStatusMap
  })
}));

const renderIcon = (componentList: ComponentStatus[]): ReturnType<typeof render> => {
  mockStatusMap = { Kubernetes: componentList };
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <IstioStatusComponent
          namespaces={[
            { name: 'bookinfo', cluster: CLUSTER_DEFAULT },
            { name: 'istio-system', cluster: CLUSTER_DEFAULT }
          ]}
        />
      </MemoryRouter>
    </Provider>
  );
};

const testSnapshot = (container: HTMLElement): void => {
  expect(container).toMatchSnapshot();
};

const testIcon = (container: HTMLElement, dataTest: string): void => {
  const element = container.querySelector(`[data-test="${dataTest}"]`);
  expect(element).toBeInTheDocument();
};

const testTooltip = async (container: HTMLElement): Promise<void> => {
  const user = userEvent.setup();
  const statusElement = container.querySelector('[data-test^="istio-status-"]');
  expect(statusElement).toBeInTheDocument();
  await user.hover(statusElement!);
  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
};

jest.mock('../../../utils/MeshUtils', () => ({
  isControlPlaneAccessible: () => true
}));

describe('When core component has a problem', () => {
  beforeEach(() => {
    serverConfig.clusters = {
      CLUSTER_DEFAULT: {
        accessible: true,
        apiEndpoint: '',
        isKialiHome: true,
        kialiInstances: [],
        name: CLUSTER_DEFAULT,
        secretName: 'test-secret'
      }
    };
    setServerConfig(serverConfig);
  });

  it('the Icon shows is displayed in Red', async () => {
    const { container } = renderIcon([
      {
        cluster: CLUSTER_DEFAULT,
        name: 'grafana',
        status: Status.Healthy,
        isCore: false
      },
      {
        cluster: CLUSTER_DEFAULT,
        name: 'istio-egressgateway',
        status: Status.Unhealthy,
        isCore: true
      }
    ]);

    testSnapshot(container);
    testIcon(container, 'istio-status-danger');
    await testTooltip(container);
  });
});

describe('When addon component has a problem', () => {
  it('the Icon shows is displayed in orange', async () => {
    const { container } = renderIcon([
      {
        cluster: CLUSTER_DEFAULT,
        name: 'grafana',
        status: Status.Unhealthy,
        isCore: false
      },
      {
        cluster: CLUSTER_DEFAULT,
        name: 'istio-egressgateway',
        status: Status.Healthy,
        isCore: true
      }
    ]);

    testSnapshot(container);
    testIcon(container, 'istio-status-warning');
    await testTooltip(container);
  });
});

describe('When both core and addon component have problems', () => {
  describe('any component is in not ready', () => {
    it('the Icon shows is displayed in red', async () => {
      const { container } = renderIcon([
        {
          cluster: CLUSTER_DEFAULT,
          name: 'grafana',
          status: Status.Unhealthy,
          isCore: false
        },
        {
          cluster: CLUSTER_DEFAULT,
          name: 'istio-egressgateway',
          status: Status.Unhealthy,
          isCore: true
        }
      ]);

      testSnapshot(container);
      testIcon(container, 'istio-status-danger');
      await testTooltip(container);
    });
  });
});

describe('When there are not-ready components', () => {
  describe('mixed with other not healthy components', () => {
    describe('in core', () => {
      it('the Icon is displayed in red', async () => {
        const { container } = renderIcon([
          {
            cluster: CLUSTER_DEFAULT,
            name: 'istio-egressgateway',
            status: Status.Unhealthy,
            isCore: true
          },
          {
            cluster: CLUSTER_DEFAULT,
            name: 'istio-ingressgateway',
            status: Status.NotReady,
            isCore: true
          }
        ]);

        testSnapshot(container);
        testIcon(container, 'istio-status-danger');
        await testTooltip(container);
      });
    });

    describe('in addons', () => {
      it('the Icon is displayed in orange', async () => {
        const { container } = renderIcon([
          {
            cluster: CLUSTER_DEFAULT,
            name: 'grafana',
            status: Status.Unhealthy,
            isCore: false
          },
          {
            cluster: CLUSTER_DEFAULT,
            name: 'jaeger',
            status: Status.NotReady,
            isCore: false
          }
        ]);

        testSnapshot(container);
        testIcon(container, 'istio-status-warning');
        await testTooltip(container);
      });
    });

    describe('in both', () => {
      it('the Icon shows is displayed in red', async () => {
        const { container } = renderIcon([
          {
            cluster: CLUSTER_DEFAULT,
            name: 'grafana',
            status: Status.Unhealthy,
            isCore: false
          },
          {
            cluster: CLUSTER_DEFAULT,
            name: 'jaeger',
            status: Status.NotReady,
            isCore: false
          },
          {
            cluster: CLUSTER_DEFAULT,
            name: 'istio-egressgateway',
            status: Status.Unhealthy,
            isCore: true
          },
          {
            cluster: CLUSTER_DEFAULT,
            name: 'istio-ingressgateway',
            status: Status.NotReady,
            isCore: true
          }
        ]);

        testSnapshot(container);
        testIcon(container, 'istio-status-danger');
        await testTooltip(container);
      });
    });
  });

  describe('not mixed with other unhealthy components', () => {
    describe('in core', () => {
      it('renders the Icon in blue', async () => {
        const { container } = renderIcon([
          {
            cluster: CLUSTER_DEFAULT,
            name: 'jaeger',
            status: Status.NotReady,
            isCore: false
          }
        ]);

        testSnapshot(container);
        testIcon(container, 'istio-status-info');
        await testTooltip(container);
      });
    });

    describe('in addons', () => {
      it('renders the Icon in blue', async () => {
        const { container } = renderIcon([
          {
            cluster: CLUSTER_DEFAULT,
            name: 'istiod',
            status: Status.NotReady,
            isCore: true
          }
        ]);

        testSnapshot(container);
        testIcon(container, 'istio-status-info');
        await testTooltip(container);
      });
    });
  });
});

describe('When all components are good', () => {
  it('the Icon shows is displayed in green', () => {
    const { container } = renderIcon([
      {
        cluster: CLUSTER_DEFAULT,
        name: 'grafana',
        status: Status.Healthy,
        isCore: false
      },
      {
        cluster: CLUSTER_DEFAULT,
        name: 'istio-egressgateway',
        status: Status.Healthy,
        isCore: true
      }
    ]);

    testIcon(container, 'istio-status-success');
  });
});

describe('When there are multiple clusters', () => {
  beforeEach(() => {
    serverConfig.clusters = {
      CLUSTER_DEFAULT: {
        accessible: true,
        apiEndpoint: '',
        isKialiHome: true,
        kialiInstances: [],
        name: CLUSTER_DEFAULT,
        secretName: 'test-secret'
      },
      'cluster-2': {
        accessible: true,
        apiEndpoint: '',
        isKialiHome: false,
        kialiInstances: [],
        name: 'cluster-2',
        secretName: 'test-secret-2'
      }
    };
    setServerConfig(serverConfig);
  });

  it('cluster with failing components shows expand/collapse arrow', () => {
    mockStatusMap = {
      [CLUSTER_DEFAULT]: [
        {
          cluster: CLUSTER_DEFAULT,
          name: 'istiod',
          status: Status.Unhealthy,
          isCore: true
        }
      ],
      'cluster-2': [
        {
          cluster: 'cluster-2',
          name: 'istiod',
          status: Status.Healthy,
          isCore: true
        }
      ]
    };
    const { container } = render(
      <Provider store={store}>
        <MemoryRouter>
          <IstioStatusComponent
            namespaces={[
              { name: 'bookinfo', cluster: CLUSTER_DEFAULT },
              { name: 'istio-system', cluster: CLUSTER_DEFAULT }
            ]}
          />
        </MemoryRouter>
      </Provider>
    );

    testSnapshot(container);
    testIcon(container, 'istio-status-danger');
  });

  it('clusters without failing components do not show expand/collapse arrow', () => {
    mockStatusMap = {
      [CLUSTER_DEFAULT]: [
        {
          cluster: CLUSTER_DEFAULT,
          name: 'istiod',
          status: Status.Healthy,
          isCore: true
        }
      ],
      'cluster-2': [
        {
          cluster: 'cluster-2',
          name: 'istiod',
          status: Status.Healthy,
          isCore: true
        },
        {
          cluster: 'cluster-2',
          name: 'grafana',
          status: Status.Healthy,
          isCore: false
        }
      ]
    };
    const { container } = render(
      <Provider store={store}>
        <MemoryRouter>
          <IstioStatusComponent
            namespaces={[
              { name: 'bookinfo', cluster: CLUSTER_DEFAULT },
              { name: 'istio-system', cluster: CLUSTER_DEFAULT }
            ]}
          />
        </MemoryRouter>
      </Provider>
    );

    testSnapshot(container);
    testIcon(container, 'istio-status-success');

    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(0);
  });
});
