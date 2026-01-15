import * as React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { ComponentStatus, Status } from '../../../types/IstioStatus';
import { IstioStatusComponent } from '../IstioStatus';
import { mountToJson } from 'enzyme-to-json';
import { CLUSTER_DEFAULT } from '../../../types/Graph';
import { serverConfig } from '../../../config';
import { setServerConfig } from '../../../config/ServerConfig';
import { MemoryRouter } from 'react-router-dom-v5-compat';

const mockIcon = (componentList: ComponentStatus[]): ReactWrapper => {
  return mount(
    <MemoryRouter>
      <IstioStatusComponent
        statusMap={{ Kubernetes: componentList }}
        lastRefreshAt={848152}
        namespaces={[
          { name: 'bookinfo', cluster: CLUSTER_DEFAULT },
          { name: 'istio-system', cluster: CLUSTER_DEFAULT }
        ]}
        setIstioStatus={jest.fn()}
      />
    </MemoryRouter>
  );
};

const testSnapshot = (wrapper: any): void => {
  const component = wrapper.find('IstioStatusComponent').first();
  expect(mountToJson(component)).toBeDefined();
  expect(mountToJson(component)).toMatchSnapshot();
};

const testTooltip = (wrapper: any): void => {
  const tooltip = wrapper.find('Tooltip').first();
  expect(tooltip.exists()).toBe(true);
  expect(tooltip.props().position).toEqual('top');
  expect(tooltip.props().enableFlip).toEqual(true);
};

const testIcon = (wrapper: any, dataTest: string, expectedStatus: string): void => {
  const labelWrapper = wrapper.find(`[data-test="${dataTest}"]`).first();
  expect(labelWrapper.exists()).toBe(true);
  expect(labelWrapper.prop('status')).toBe(expectedStatus);
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

  it('the Icon shows is displayed in Red', () => {
    const wrapper = mockIcon([
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

    testSnapshot(wrapper);
    testTooltip(wrapper);
    testIcon(wrapper, 'istio-status-danger', 'danger');
  });
});

describe('When addon component has a problem', () => {
  it('the Icon shows is displayed in orange', () => {
    const wrapper = mockIcon([
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

    testSnapshot(wrapper);
    testTooltip(wrapper);
    testIcon(wrapper, 'istio-status-warning', 'warning');
  });
});

describe('When both core and addon component have problems', () => {
  describe('any component is in not ready', () => {
    it('the Icon shows is displayed in red', () => {
      const wrapper = mockIcon([
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

      testSnapshot(wrapper);
      testTooltip(wrapper);
      testIcon(wrapper, 'istio-status-danger', 'danger');
    });
  });
});

describe('When there are not-ready components', () => {
  describe('mixed with other not healthy components', () => {
    describe('in core', () => {
      it('the Icon is displayed in red', () => {
        const wrapper = mockIcon([
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

        testSnapshot(wrapper);
        testTooltip(wrapper);
        testIcon(wrapper, 'istio-status-danger', 'danger');
      });
    });

    describe('in addons', () => {
      it('the Icon is displayed in orange', () => {
        const wrapper = mockIcon([
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

        testSnapshot(wrapper);
        testTooltip(wrapper);
        testIcon(wrapper, 'istio-status-warning', 'warning');
      });
    });

    describe('in both', () => {
      it('the Icon shows is displayed in red', () => {
        const wrapper = mockIcon([
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

        testSnapshot(wrapper);
        testTooltip(wrapper);
        testIcon(wrapper, 'istio-status-danger', 'danger');
      });
    });
  });

  describe('not mixed with other unhealthy components', () => {
    describe('in core', () => {
      it('renders the Icon in blue', () => {
        const wrapper = mockIcon([
          {
            cluster: CLUSTER_DEFAULT,
            name: 'jaeger',
            status: Status.NotReady,
            isCore: false
          }
        ]);

        testSnapshot(wrapper);
        testTooltip(wrapper);
        testIcon(wrapper, 'istio-status-info', 'success');
      });
    });

    describe('in addons', () => {
      it('renders the Icon in blue', () => {
        const wrapper = mockIcon([
          {
            cluster: CLUSTER_DEFAULT,
            name: 'istiod',
            status: Status.NotReady,
            isCore: true
          }
        ]);

        testSnapshot(wrapper);
        testTooltip(wrapper);
        testIcon(wrapper, 'istio-status-info', 'success');
      });
    });
  });
});

describe('When all components are good', () => {
  it('the Icon shows is displayed in green', () => {
    const wrapper = mockIcon([
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

    testIcon(wrapper, 'istio-status-success', 'success');
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
    const wrapper = mount(
      <MemoryRouter>
        <IstioStatusComponent
          statusMap={{
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
          }}
          lastRefreshAt={848152}
          namespaces={[
            { name: 'bookinfo', cluster: CLUSTER_DEFAULT },
            { name: 'istio-system', cluster: CLUSTER_DEFAULT }
          ]}
          setIstioStatus={jest.fn()}
        />
      </MemoryRouter>
    );

    testSnapshot(wrapper);
    testTooltip(wrapper);
    testIcon(wrapper, 'istio-status-danger', 'danger');
  });

  it('clusters without failing components do not show expand/collapse arrow', () => {
    const wrapper = mount(
      <MemoryRouter>
        <IstioStatusComponent
          statusMap={{
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
          }}
          lastRefreshAt={848152}
          namespaces={[
            { name: 'bookinfo', cluster: CLUSTER_DEFAULT },
            { name: 'istio-system', cluster: CLUSTER_DEFAULT }
          ]}
          setIstioStatus={jest.fn()}
        />
      </MemoryRouter>
    );

    testSnapshot(wrapper);
    testTooltip(wrapper);
    testIcon(wrapper, 'istio-status-success', 'success');

    // When all clusters are healthy, they all show up but without expand/collapse buttons
    // Verify there are no expand/collapse buttons (plain variant buttons)
    const buttons = wrapper.find('Button[variant="plain"]');
    expect(buttons).toHaveLength(0);
  });
});
