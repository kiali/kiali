import { filterByLabel } from '../LabelFilterHelper';
import { AppListItem } from '../../types/AppList';
import { AppHealth, WorkloadHealth, ServiceHealth } from '../../types/Health';
import { WorkloadListItem } from '../../types/Workload';
import { InstanceType } from 'types/Common';
import { ServiceListItem } from '../../types/ServiceList';
import { setServerConfig } from '../../config/ServerConfig';
import { serverRateConfig } from '../../types/ErrorRate/__testData__/ErrorRateConfig';
import { dicTypeToGVK, gvkType } from '../../types/IstioConfigList';

setServerConfig(serverRateConfig);
const emptyAppHealth = new AppHealth(
  '',
  '',
  [],
  { inbound: {}, outbound: {}, healthAnnotations: {} },
  { rateInterval: 20, hasSidecar: true, hasAmbient: false }
);
const emptyWorkHealth = new WorkloadHealth(
  '',
  '',
  { desiredReplicas: 0, currentReplicas: 0, availableReplicas: 0, name: '', syncedProxies: 0 },
  { inbound: {}, outbound: {}, healthAnnotations: {} },
  { rateInterval: 20, hasSidecar: true, hasAmbient: false }
);
const emptySvcHealth = new ServiceHealth(
  '',
  '',
  { inbound: {}, outbound: {}, healthAnnotations: {} },
  { rateInterval: 20, hasSidecar: true, hasAmbient: false }
);
const appList: AppListItem[] = [
  {
    namespace: 'bookinfo',
    instanceType: InstanceType.App,
    health: emptyAppHealth,
    name: 'ratings',
    istioSidecar: false,
    isAmbient: false,
    isGateway: false,
    isWaypoint: false,
    isZtunnel: false,
    labels: { app: 'ratings', service: 'ratings', version: 'v1' },
    istioReferences: []
  },
  {
    namespace: 'bookinfo',
    health: emptyAppHealth,
    name: 'productpage',
    instanceType: InstanceType.App,
    istioSidecar: false,
    isAmbient: false,
    isGateway: false,
    isWaypoint: false,
    isZtunnel: false,
    labels: { app: 'productpage', service: 'productpage', version: 'v1' },
    istioReferences: []
  },
  {
    namespace: 'bookinfo',
    health: emptyAppHealth,
    name: 'details',
    instanceType: InstanceType.App,
    istioSidecar: false,
    isAmbient: false,
    isGateway: false,
    isWaypoint: false,
    isZtunnel: false,
    labels: { app: 'details', service: 'details', version: 'v1' },
    istioReferences: []
  },
  {
    namespace: 'bookinfo',
    health: emptyAppHealth,
    name: 'reviews',
    instanceType: InstanceType.App,
    istioSidecar: false,
    isAmbient: false,
    isGateway: false,
    isWaypoint: false,
    isZtunnel: false,
    labels: { app: 'reviews', service: 'reviews', version: 'v1,v2,v3' },
    istioReferences: []
  }
];

const workloadList: WorkloadListItem[] = [
  {
    namespace: 'bookinfo',
    health: emptyWorkHealth,
    name: 'details-v1',
    gvk: dicTypeToGVK[gvkType.Deployment],
    istioSidecar: false,
    isAmbient: false,
    isGateway: false,
    isWaypoint: false,
    isZtunnel: false,
    labels: { app: 'details', version: 'v1' },
    appLabel: true,
    versionLabel: true,
    istioReferences: [],
    instanceType: InstanceType.Workload
  },
  {
    namespace: 'bookinfo',
    health: emptyWorkHealth,
    name: 'productpage-v1',
    gvk: dicTypeToGVK[gvkType.Deployment],
    istioSidecar: false,
    isAmbient: false,
    isGateway: false,
    isWaypoint: false,
    isZtunnel: false,
    labels: { app: 'productpage', version: 'v1' },
    appLabel: true,
    versionLabel: true,
    istioReferences: [],
    instanceType: InstanceType.Workload
  },
  {
    namespace: 'bookinfo',
    health: emptyWorkHealth,
    name: 'ratings-v1',
    gvk: dicTypeToGVK[gvkType.Deployment],
    istioSidecar: false,
    isAmbient: false,
    isGateway: false,
    isWaypoint: false,
    isZtunnel: false,
    labels: { app: 'ratings', version: 'v1' },
    appLabel: true,
    versionLabel: true,
    istioReferences: [],
    instanceType: InstanceType.Workload
  },
  {
    namespace: 'bookinfo',
    health: emptyWorkHealth,
    name: 'reviews-v1',
    gvk: dicTypeToGVK[gvkType.Deployment],
    istioSidecar: false,
    isAmbient: false,
    isGateway: false,
    isWaypoint: false,
    isZtunnel: false,
    labels: { app: 'reviews', version: 'v1' },
    appLabel: true,
    versionLabel: true,
    istioReferences: [],
    instanceType: InstanceType.Workload
  },
  {
    namespace: 'bookinfo',
    health: emptyWorkHealth,
    name: 'reviews-v2',
    gvk: dicTypeToGVK[gvkType.Deployment],
    istioSidecar: false,
    isAmbient: false,
    isGateway: false,
    isWaypoint: false,
    isZtunnel: false,
    labels: { app: 'reviews', version: 'v2' },
    appLabel: true,
    versionLabel: true,
    istioReferences: [],
    instanceType: InstanceType.Workload
  },
  {
    namespace: 'bookinfo',
    health: emptyWorkHealth,
    name: 'reviews-v3',
    gvk: dicTypeToGVK[gvkType.Deployment],
    istioSidecar: false,
    isAmbient: false,
    isGateway: false,
    isWaypoint: false,
    isZtunnel: false,
    labels: { app: 'reviews', version: 'v3' },
    appLabel: true,
    versionLabel: true,
    istioReferences: [],
    instanceType: InstanceType.Workload
  }
];

const serviceList: ServiceListItem[] = [
  {
    namespace: 'bookinfo',
    health: emptySvcHealth,
    name: 'details',
    instanceType: InstanceType.Service,
    istioSidecar: false,
    isAmbient: false,
    isWaypoint: false,
    isZtunnel: false,
    labels: { app: 'details', service: 'details' },
    ports: { http: 9080 },
    validation: { name: 'details', objectGVK: { Group: '', Version: '', Kind: 'service' }, valid: true, checks: [] },
    istioReferences: [],
    kialiWizard: '',
    serviceRegistry: 'Kubernetes'
  },
  {
    namespace: 'bookinfo',
    health: emptySvcHealth,
    name: 'reviews',
    instanceType: InstanceType.Service,
    istioSidecar: false,
    isAmbient: false,
    isWaypoint: false,
    isZtunnel: false,
    labels: { app: 'reviews', service: 'reviews' },
    ports: { http: 9080 },
    validation: { name: 'reviews', objectGVK: { Group: '', Version: '', Kind: 'service' }, valid: true, checks: [] },
    istioReferences: [],
    kialiWizard: '',
    serviceRegistry: 'Kubernetes'
  },
  {
    namespace: 'bookinfo',
    health: emptySvcHealth,
    name: 'ratings',
    instanceType: InstanceType.Service,
    istioSidecar: false,
    isAmbient: false,
    isWaypoint: false,
    isZtunnel: false,
    labels: { app: 'ratings', service: 'ratings' },
    ports: { http: 9080 },
    validation: { name: 'ratings', objectGVK: { Group: '', Version: '', Kind: 'service' }, valid: true, checks: [] },
    istioReferences: [],
    kialiWizard: '',
    serviceRegistry: 'Kubernetes'
  },
  {
    namespace: 'bookinfo',
    health: emptySvcHealth,
    name: 'productpage',
    instanceType: InstanceType.Service,
    istioSidecar: false,
    isAmbient: false,
    labels: { app: 'productpage', service: 'productpage' },
    isWaypoint: false,
    isZtunnel: false,
    ports: { http: 9080 },
    validation: {
      name: 'productpage',
      objectGVK: { Group: '', Version: '', Kind: 'service' },
      valid: true,
      checks: []
    },
    istioReferences: [],
    kialiWizard: '',
    serviceRegistry: 'Kubernetes'
  }
];

describe('LabelFilter', () => {
  it('check Label Filter with AppList and OR Operation', () => {
    const result = filterByLabel(appList, ['app', 'service=details']);
    expect(result).toEqual(appList);
  });

  it('check Label Filter with AppList and AND Operation', () => {
    const result = filterByLabel(appList, ['app', 'service=details'], 'and');
    expect(result).toEqual([
      {
        namespace: 'bookinfo',
        instanceType: InstanceType.App,
        health: emptyAppHealth,
        name: 'details',
        istioSidecar: false,
        isAmbient: false,
        isGateway: false,
        isWaypoint: false,
        isZtunnel: false,
        labels: { app: 'details', service: 'details', version: 'v1' },
        istioReferences: []
      }
    ]);
  });

  it('check Label Filter with AppList and AND Operation with multiple values', () => {
    const result = filterByLabel(appList, ['app', 'version=v2'], 'and');
    expect(result).toEqual([
      {
        namespace: 'bookinfo',
        instanceType: InstanceType.App,
        health: emptyAppHealth,
        name: 'reviews',
        istioSidecar: false,
        isAmbient: false,
        isGateway: false,
        isWaypoint: false,
        isZtunnel: false,
        labels: { app: 'reviews', service: 'reviews', version: 'v1,v2,v3' },
        istioReferences: []
      }
    ]);
  });

  it('check Label Filter with WorkloadList and OR Operation', () => {
    const result = filterByLabel(workloadList, ['app', 'version=v1']);
    expect(result).toEqual(workloadList);
  });

  it('check Label Filter with WorkloadList and AND Operation', () => {
    const result = filterByLabel(workloadList, ['app=reviews', 'version'], 'and');
    expect(result).toEqual([
      {
        namespace: 'bookinfo',
        instanceType: InstanceType.Workload,
        health: emptyWorkHealth,
        name: 'reviews-v1',
        gvk: dicTypeToGVK[gvkType.Deployment],
        istioSidecar: false,
        isAmbient: false,
        isGateway: false,
        isWaypoint: false,
        isZtunnel: false,
        labels: { app: 'reviews', version: 'v1' },
        appLabel: true,
        versionLabel: true,
        istioReferences: []
      },
      {
        namespace: 'bookinfo',
        instanceType: InstanceType.Workload,
        health: emptyWorkHealth,
        name: 'reviews-v2',
        gvk: dicTypeToGVK[gvkType.Deployment],
        istioSidecar: false,
        isAmbient: false,
        isGateway: false,
        isWaypoint: false,
        isZtunnel: false,
        labels: { app: 'reviews', version: 'v2' },
        appLabel: true,
        versionLabel: true,
        istioReferences: []
      },
      {
        namespace: 'bookinfo',
        instanceType: InstanceType.Workload,
        health: emptyWorkHealth,
        name: 'reviews-v3',
        gvk: dicTypeToGVK[gvkType.Deployment],
        istioSidecar: false,
        isAmbient: false,
        isGateway: false,
        isWaypoint: false,
        isZtunnel: false,
        labels: { app: 'reviews', version: 'v3' },
        appLabel: true,
        versionLabel: true,
        istioReferences: []
      }
    ]);
  });

  it('check Label Filter with ServiceList and OR Operation', () => {
    const result = filterByLabel(serviceList, ['app', 'service=details']);
    expect(result).toEqual(serviceList);
  });

  it('check Label Filter with ServiceList and AND Operation', () => {
    const result = filterByLabel(serviceList, ['app', 'service=de'], 'and');
    expect(result).toEqual([
      {
        namespace: 'bookinfo',
        health: emptySvcHealth,
        name: 'details',
        instanceType: InstanceType.Service,
        istioSidecar: false,
        isAmbient: false,
        isWaypoint: false,
        isZtunnel: false,
        labels: { app: 'details', service: 'details' },
        ports: { http: 9080 },
        validation: {
          name: 'details',
          objectGVK: { Group: '', Version: '', Kind: 'service' },
          valid: true,
          checks: []
        },
        istioReferences: [],
        kialiWizard: '',
        serviceRegistry: 'Kubernetes'
      }
    ]);
  });
});
