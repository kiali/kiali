import * as React from 'react';
import { shallow, ShallowWrapper } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';
import { Spire } from '../Spire';
import { Workload, SpireManagedIdentityMatch } from '../../../types/Workload';
import { ServiceDetailsInfo, Service, WorkloadOverview } from '../../../types/ServiceInfo';
import { App, AppWorkload } from '../../../types/App';
import { InstanceType } from '../../../types/Common';
import { AppHealthResponse } from '../../../types/Health';

const mockService: Service = {
  additionalDetails: [],
  annotations: {},
  cluster: 'Kubernetes',
  name: 'test-service',
  namespace: 'default',
  createdAt: '',
  resourceVersion: '',
  labels: {},
  type: 'ClusterIP',
  ip: '10.0.0.1',
  ports: [],
  externalName: ''
};

const mockServiceDetailsInfo = (workloads?: WorkloadOverview[]): ServiceDetailsInfo => ({
  service: mockService,
  workloads: workloads,
  endpoints: [],
  virtualServices: [],
  destinationRules: [],
  k8sHTTPRoutes: [],
  k8sGRPCRoutes: [],
  k8sInferencePools: [],
  serviceEntries: [],
  istioPermissions: { create: false, update: false, delete: false },
  validations: {},
  isAmbient: false,
  istioSidecar: false
});

const mockWorkloadOverview = (spireManaged: boolean, name = 'test-workload'): WorkloadOverview => ({
  name: name,
  namespace: 'default',
  createdAt: '',
  resourceVersion: '',
  type: 'Deployment',
  isAmbient: false,
  isGateway: false,
  isWaypoint: false,
  isZtunnel: false,
  istioSidecar: true,
  serviceAccountNames: [],
  spireInfo: spireManaged
    ? {
        isSpireManaged: true,
        isSpireServer: false
      }
    : undefined
});

const mockAppWorkload = (spireManaged: boolean, name = 'test-workload'): AppWorkload => ({
  workloadName: name,
  namespace: 'default',
  gvk: { Group: '', Version: '', Kind: '' },
  isAmbient: false,
  isGateway: false,
  isWaypoint: false,
  isZtunnel: false,
  istioSidecar: true,
  labels: {},
  serviceAccountNames: [],
  spireInfo: spireManaged
    ? {
        isSpireManaged: true,
        isSpireServer: false
      }
    : undefined
});

const mockAppHealth = (): AppHealthResponse => ({
  workloadStatuses: [],
  requests: {
    healthAnnotations: {},
    inbound: {},
    outbound: {}
  }
});

describe('Spire component', () => {
  describe('Workload type', () => {
    it('renders null when workload has no SPIRE info', () => {
      const workload: Workload = {
        additionalDetails: [],
        annotations: {},
        appLabel: false,
        availableReplicas: 0,
        createdAt: '',
        gvk: { Group: '', Version: '', Kind: '' },
        isAmbient: false,
        isGateway: false,
        isWaypoint: false,
        isZtunnel: false,
        istioSidecar: true,
        labels: {},
        name: 'test-workload',
        namespace: 'default',
        instanceType: InstanceType.Workload,
        pods: [],
        replicas: 0,
        resourceVersion: '',
        runtimes: [],
        services: [],
        versionLabel: false,
        waypointWorkloads: [],
        workloadEntries: []
      };

      const wrapper: ShallowWrapper = shallow(<Spire object={workload} objectType="workload" />);
      expect(wrapper.type()).toBeNull();
    });

    it('renders null when workload is not SPIRE managed', () => {
      const workload: Workload = {
        additionalDetails: [],
        annotations: {},
        appLabel: false,
        availableReplicas: 0,
        createdAt: '',
        gvk: { Group: '', Version: '', Kind: '' },
        isAmbient: false,
        isGateway: false,
        isWaypoint: false,
        isZtunnel: false,
        istioSidecar: true,
        labels: {},
        name: 'test-workload',
        namespace: 'default',
        instanceType: InstanceType.Workload,
        pods: [],
        replicas: 0,
        resourceVersion: '',
        runtimes: [],
        services: [],
        versionLabel: false,
        waypointWorkloads: [],
        workloadEntries: [],
        spireInfo: {
          isSpireManaged: false,
          isSpireServer: false
        }
      };

      const wrapper: ShallowWrapper = shallow(<Spire object={workload} objectType="workload" />);
      expect(wrapper.type()).toBeNull();
    });

    it('renders card with single identity match', () => {
      const managedIdentityMatches: SpireManagedIdentityMatch[] = [
        {
          matchType: 'Labels',
          matchValue: 'spiffe.io/spire-managed-identity: true'
        }
      ];

      const workload: Workload = {
        additionalDetails: [],
        annotations: {},
        appLabel: false,
        availableReplicas: 0,
        createdAt: '',
        gvk: { Group: '', Version: '', Kind: '' },
        isAmbient: false,
        isGateway: false,
        isWaypoint: false,
        isZtunnel: false,
        istioSidecar: true,
        labels: {},
        name: 'test-workload',
        namespace: 'default',
        instanceType: InstanceType.Workload,
        pods: [],
        replicas: 0,
        resourceVersion: '',
        runtimes: [],
        services: [],
        versionLabel: false,
        waypointWorkloads: [],
        workloadEntries: [],
        spireInfo: {
          isSpireManaged: true,
          isSpireServer: false,
          managedIdentityMatches
        }
      };

      const wrapper: ShallowWrapper = shallow(<Spire object={workload} objectType="workload" />);
      expect(wrapper.type()).not.toBeNull();
      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();
      expect(wrapper.find('#SpireCard').exists()).toBeTruthy();
    });

    it('renders card with multiple identity matches', () => {
      const managedIdentityMatches: SpireManagedIdentityMatch[] = [
        {
          matchType: 'Annotations',
          matchValue: 'inject.istio.io/templates: spire'
        },
        {
          matchType: 'Labels',
          matchValue: 'spiffe.io/spire-managed-identity: true'
        },
        {
          matchType: 'PodLabels',
          matchValue: 'spiffe.io/spire-managed-identity: true'
        }
      ];

      const workload: Workload = {
        additionalDetails: [],
        annotations: {},
        appLabel: false,
        availableReplicas: 0,
        createdAt: '',
        gvk: { Group: '', Version: '', Kind: '' },
        isAmbient: false,
        isGateway: false,
        isWaypoint: false,
        isZtunnel: false,
        istioSidecar: true,
        labels: {},
        name: 'test-workload',
        namespace: 'default',
        instanceType: InstanceType.Workload,
        pods: [],
        replicas: 0,
        resourceVersion: '',
        runtimes: [],
        services: [],
        versionLabel: false,
        waypointWorkloads: [],
        workloadEntries: [],
        spireInfo: {
          isSpireManaged: true,
          isSpireServer: false,
          managedIdentityMatches
        }
      };

      const wrapper: ShallowWrapper = shallow(<Spire object={workload} objectType="workload" />);
      expect(wrapper.type()).not.toBeNull();
      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();
      expect(wrapper.find('#SpireCard').exists()).toBeTruthy();
    });

    it('renders null when workload is SPIRE server', () => {
      const workload: Workload = {
        additionalDetails: [],
        annotations: {},
        appLabel: false,
        availableReplicas: 0,
        createdAt: '',
        gvk: { Group: '', Version: '', Kind: '' },
        isAmbient: false,
        isGateway: false,
        isWaypoint: false,
        isZtunnel: false,
        istioSidecar: true,
        labels: {},
        name: 'spire-server',
        namespace: 'spire',
        instanceType: InstanceType.Workload,
        pods: [],
        replicas: 0,
        resourceVersion: '',
        runtimes: [],
        services: [],
        versionLabel: false,
        waypointWorkloads: [],
        workloadEntries: [],
        spireInfo: {
          isSpireManaged: false,
          isSpireServer: true
        }
      };

      const wrapper: ShallowWrapper = shallow(<Spire object={workload} objectType="workload" />);
      expect(wrapper.type()).toBeNull();
    });
  });

  describe('Service type', () => {
    it('renders null when service has no workloads', () => {
      const service = mockServiceDetailsInfo();

      const wrapper: ShallowWrapper = shallow(<Spire object={service} objectType="service" />);
      expect(wrapper.type()).toBeNull();
    });

    it('renders null when service has no SPIRE-managed workloads', () => {
      const service = mockServiceDetailsInfo([mockWorkloadOverview(false)]);

      const wrapper: ShallowWrapper = shallow(<Spire object={service} objectType="service" />);
      expect(wrapper.type()).toBeNull();
    });

    it('renders card when service has SPIRE-managed workloads', () => {
      const service = mockServiceDetailsInfo([mockWorkloadOverview(true)]);

      const wrapper: ShallowWrapper = shallow(<Spire object={service} objectType="service" />);
      expect(wrapper.type()).not.toBeNull();
      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();
      expect(wrapper.find('#SpireCard').exists()).toBeTruthy();
    });

    it('renders card when service has mixed workloads (some SPIRE-managed)', () => {
      const service = mockServiceDetailsInfo([
        mockWorkloadOverview(false, 'workload-no-spire'),
        mockWorkloadOverview(true, 'workload-with-spire')
      ]);

      const wrapper: ShallowWrapper = shallow(<Spire object={service} objectType="service" />);
      expect(wrapper.type()).not.toBeNull();
      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();
      expect(wrapper.find('#SpireCard').exists()).toBeTruthy();
    });

    it('renders card when service has multiple SPIRE-managed workloads', () => {
      const service = mockServiceDetailsInfo([
        mockWorkloadOverview(true, 'workload-1'),
        mockWorkloadOverview(true, 'workload-2')
      ]);

      const wrapper: ShallowWrapper = shallow(<Spire object={service} objectType="service" />);
      expect(wrapper.type()).not.toBeNull();
      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();
      expect(wrapper.find('#SpireCard').exists()).toBeTruthy();
    });
  });

  describe('App type', () => {
    it('renders null when app has no SPIRE-managed workloads', () => {
      const app: App = {
        name: 'test-app',
        namespace: { name: 'default' },
        health: mockAppHealth(),
        runtimes: [],
        serviceNames: [],
        instanceType: InstanceType.App,
        isAmbient: false,
        workloads: [mockAppWorkload(false)]
      };

      const wrapper: ShallowWrapper = shallow(<Spire object={app} objectType="app" />);
      expect(wrapper.type()).toBeNull();
    });

    it('renders card when app has SPIRE-managed workloads', () => {
      const app: App = {
        name: 'test-app',
        namespace: { name: 'default' },
        health: mockAppHealth(),
        runtimes: [],
        serviceNames: [],
        instanceType: InstanceType.App,
        isAmbient: false,
        workloads: [mockAppWorkload(true)]
      };

      const wrapper: ShallowWrapper = shallow(<Spire object={app} objectType="app" />);
      expect(wrapper.type()).not.toBeNull();
      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();
      expect(wrapper.find('#SpireCard').exists()).toBeTruthy();
    });

    it('renders card when app has multiple SPIRE-managed workloads', () => {
      const app: App = {
        name: 'test-app',
        namespace: { name: 'default' },
        health: mockAppHealth(),
        runtimes: [],
        serviceNames: [],
        instanceType: InstanceType.App,
        isAmbient: false,
        workloads: [mockAppWorkload(true, 'workload-1'), mockAppWorkload(true, 'workload-2')]
      };

      const wrapper: ShallowWrapper = shallow(<Spire object={app} objectType="app" />);
      expect(wrapper.type()).not.toBeNull();
      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();
      expect(wrapper.find('#SpireCard').exists()).toBeTruthy();
    });

    it('renders card when app has mixed workloads (some SPIRE-managed)', () => {
      const app: App = {
        name: 'test-app',
        namespace: { name: 'default' },
        health: mockAppHealth(),
        runtimes: [],
        serviceNames: [],
        instanceType: InstanceType.App,
        isAmbient: false,
        workloads: [mockAppWorkload(false, 'workload-no-spire'), mockAppWorkload(true, 'workload-with-spire')]
      };

      const wrapper: ShallowWrapper = shallow(<Spire object={app} objectType="app" />);
      expect(wrapper.type()).not.toBeNull();
      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();
      expect(wrapper.find('#SpireCard').exists()).toBeTruthy();
    });
  });
});
