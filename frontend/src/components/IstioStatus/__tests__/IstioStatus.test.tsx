import * as React from 'react';
import { ShallowWrapper, shallow } from 'enzyme';
import { ComponentStatus, Status } from '../../../types/IstioStatus';
import { IstioStatusComponent } from '../IstioStatus';
import { shallowToJson } from 'enzyme-to-json';
import { CLUSTER_DEFAULT } from '../../../types/Graph';
import { serverConfig } from '../../../config';
import { setServerConfig } from '../../../config/ServerConfig';

const mockIcon = (componentList: ComponentStatus[]): ShallowWrapper => {
  return shallow(
    <IstioStatusComponent
      statusMap={{ Kubernetes: componentList }}
      lastRefreshAt={848152}
      namespaces={[
        { name: 'bookinfo', cluster: CLUSTER_DEFAULT },
        { name: 'istio-system', cluster: CLUSTER_DEFAULT }
      ]}
      setIstioStatus={jest.fn()}
      refreshNamespaces={jest.fn()}
    />
  );
};

const testSnapshot = (wrapper: any): void => {
  expect(shallowToJson(wrapper)).toBeDefined();
  expect(shallowToJson(wrapper)).toMatchSnapshot();
};

const testTooltip = (wrapper: any): void => {
  expect(wrapper.name()).toEqual('Tooltip');
  expect(wrapper.props().position).toEqual('top');
  expect(wrapper.props().enableFlip).toEqual(true);
  expect(wrapper.children.length).toEqual(1);
};

const testIcon = (wrapper: any, dataTest: string, iconName: string): void => {
  const clusterIcon = wrapper.childAt(0);
  expect(clusterIcon).toBeDefined();
  const icon = clusterIcon.childAt(1);
  expect(icon).toBeDefined();
  expect(icon.props()['data-test']).toEqual(dataTest);
  expect(icon.childAt(0).name()).toEqual(iconName);
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
        is_core: false
      },
      {
        cluster: CLUSTER_DEFAULT,
        name: 'istio-egressgateway',
        status: Status.Unhealthy,
        is_core: true
      }
    ]);

    testSnapshot(wrapper);
    testTooltip(wrapper);
    testIcon(wrapper, 'istio-status-danger', 'ExclamationCircleIcon');
  });
});

describe('When addon component has a problem', () => {
  it('the Icon shows is displayed in orange', () => {
    const wrapper = mockIcon([
      {
        cluster: CLUSTER_DEFAULT,
        name: 'grafana',
        status: Status.Unhealthy,
        is_core: false
      },
      {
        cluster: CLUSTER_DEFAULT,
        name: 'istio-egressgateway',
        status: Status.Healthy,
        is_core: true
      }
    ]);

    testSnapshot(wrapper);
    testTooltip(wrapper);
    testIcon(wrapper, 'istio-status-warning', 'ExclamationTriangleIcon');
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
          is_core: false
        },
        {
          cluster: CLUSTER_DEFAULT,
          name: 'istio-egressgateway',
          status: Status.Unhealthy,
          is_core: true
        }
      ]);

      testSnapshot(wrapper);
      testTooltip(wrapper);
      testIcon(wrapper, 'istio-status-danger', 'ExclamationCircleIcon');
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
            is_core: true
          },
          {
            cluster: CLUSTER_DEFAULT,
            name: 'istio-ingressgateway',
            status: Status.NotReady,
            is_core: true
          }
        ]);

        testSnapshot(wrapper);
        testTooltip(wrapper);
        testIcon(wrapper, 'istio-status-danger', 'ExclamationCircleIcon');
      });
    });

    describe('in addons', () => {
      it('the Icon is displayed in orange', () => {
        const wrapper = mockIcon([
          {
            cluster: CLUSTER_DEFAULT,
            name: 'grafana',
            status: Status.Unhealthy,
            is_core: false
          },
          {
            cluster: CLUSTER_DEFAULT,
            name: 'jaeger',
            status: Status.NotReady,
            is_core: false
          }
        ]);

        testSnapshot(wrapper);
        testTooltip(wrapper);
        testIcon(wrapper, 'istio-status-warning', 'ExclamationTriangleIcon');
      });
    });

    describe('in both', () => {
      it('the Icon shows is displayed in red', () => {
        const wrapper = mockIcon([
          {
            cluster: CLUSTER_DEFAULT,
            name: 'grafana',
            status: Status.Unhealthy,
            is_core: false
          },
          {
            cluster: CLUSTER_DEFAULT,
            name: 'jaeger',
            status: Status.NotReady,
            is_core: false
          },
          {
            cluster: CLUSTER_DEFAULT,
            name: 'istio-egressgateway',
            status: Status.Unhealthy,
            is_core: true
          },
          {
            cluster: CLUSTER_DEFAULT,
            name: 'istio-ingressgateway',
            status: Status.NotReady,
            is_core: true
          }
        ]);

        testSnapshot(wrapper);
        testTooltip(wrapper);
        testIcon(wrapper, 'istio-status-danger', 'ExclamationCircleIcon');
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
            is_core: false
          }
        ]);

        testSnapshot(wrapper);
        testTooltip(wrapper);
        testIcon(wrapper, 'istio-status-info', 'InfoCircleIcon');
      });
    });

    describe('in addons', () => {
      it('renders the Icon in blue', () => {
        const wrapper = mockIcon([
          {
            cluster: CLUSTER_DEFAULT,
            name: 'istiod',
            status: Status.NotReady,
            is_core: true
          }
        ]);

        testSnapshot(wrapper);
        testTooltip(wrapper);
        testIcon(wrapper, 'istio-status-info', 'InfoCircleIcon');
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
        is_core: false
      },
      {
        cluster: CLUSTER_DEFAULT,
        name: 'istio-egressgateway',
        status: Status.Healthy,
        is_core: true
      }
    ]);

    testIcon(wrapper, 'istio-status-success', 'CheckCircleIcon');
  });
});
