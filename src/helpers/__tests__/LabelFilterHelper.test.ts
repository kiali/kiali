import { filterByLabel } from '../LabelFilterHelper';
import { AppListItem } from '../../types/AppList';
import { WorkloadListItem } from '../../types/Workload';
import { ServiceListItem } from '../../types/ServiceList';

const appList: AppListItem[] = [
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'ratings',
    istioSidecar: false,
    labels: { app: 'ratings', service: 'ratings', version: 'v1' },
    istioReferences: []
  },
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'productpage',
    istioSidecar: false,
    labels: { app: 'productpage', service: 'productpage', version: 'v1' },
    istioReferences: []
  },
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'details',
    istioSidecar: false,
    labels: { app: 'details', service: 'details', version: 'v1' },
    istioReferences: []
  },
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'reviews',
    istioSidecar: false,
    labels: { app: 'reviews', service: 'reviews', version: 'v1,v2,v3' },
    istioReferences: []
  }
];

const workloadList: WorkloadListItem[] = [
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'details-v1',
    type: 'Deployment',
    istioSidecar: false,
    labels: { app: 'details', version: 'v1' },
    appLabel: true,
    versionLabel: true,
    istioReferences: [],
    notCoveredAuthPolicy: false
  },
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'productpage-v1',
    type: 'Deployment',
    istioSidecar: false,
    labels: { app: 'productpage', version: 'v1' },
    appLabel: true,
    versionLabel: true,
    istioReferences: [],
    notCoveredAuthPolicy: false
  },
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'ratings-v1',
    type: 'Deployment',
    istioSidecar: false,
    labels: { app: 'ratings', version: 'v1' },
    appLabel: true,
    versionLabel: true,
    istioReferences: [],
    notCoveredAuthPolicy: false
  },
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'reviews-v1',
    type: 'Deployment',
    istioSidecar: false,
    labels: { app: 'reviews', version: 'v1' },
    appLabel: true,
    versionLabel: true,
    istioReferences: [],
    notCoveredAuthPolicy: false
  },
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'reviews-v2',
    type: 'Deployment',
    istioSidecar: false,
    labels: { app: 'reviews', version: 'v2' },
    appLabel: true,
    versionLabel: true,
    istioReferences: [],
    notCoveredAuthPolicy: false
  },
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'reviews-v3',
    type: 'Deployment',
    istioSidecar: false,
    labels: { app: 'reviews', version: 'v3' },
    appLabel: true,
    versionLabel: true,
    istioReferences: [],
    notCoveredAuthPolicy: false
  }
];

const serviceList: ServiceListItem[] = [
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'details',
    istioSidecar: false,
    labels: { app: 'details', service: 'details' },
    validation: { name: 'details', objectType: 'service', valid: true, checks: [] },
    istioReferences: [],
    kialiWizard: '',
    serviceRegistry: 'Kubernetes'
  },
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'reviews',
    istioSidecar: false,
    labels: { app: 'reviews', service: 'reviews' },
    validation: { name: 'reviews', objectType: 'service', valid: true, checks: [] },
    istioReferences: [],
    kialiWizard: '',
    serviceRegistry: 'Kubernetes'
  },
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'ratings',
    istioSidecar: false,
    labels: { app: 'ratings', service: 'ratings' },
    validation: { name: 'ratings', objectType: 'service', valid: true, checks: [] },
    istioReferences: [],
    kialiWizard: '',
    serviceRegistry: 'Kubernetes'
  },
  {
    namespace: 'bookinfo',
    healthPromise: new Promise(() => {}),
    name: 'productpage',
    istioSidecar: false,
    labels: { app: 'productpage', service: 'productpage' },
    validation: { name: 'productpage', objectType: 'service', valid: true, checks: [] },
    istioReferences: [],
    kialiWizard: '',
    serviceRegistry: 'Kubernetes'
  }
];

describe('LabelFilter', () => {
  it('check Label Filter with AppList and OR Operation', () => {
    const result = filterByLabel(appList, ['app', 'service:details']);
    expect(result).toEqual(appList);
  });

  it('check Label Filter with AppList and AND Operation', () => {
    const result = filterByLabel(appList, ['app', 'service:details'], 'and');
    expect(result).toEqual([
      {
        namespace: 'bookinfo',
        healthPromise: new Promise(() => {}),
        name: 'details',
        istioSidecar: false,
        labels: { app: 'details', service: 'details', version: 'v1' },
        istioReferences: []
      }
    ]);
  });

  it('check Label Filter with AppList and AND Operation with multiple values', () => {
    const result = filterByLabel(appList, ['app', 'version:v2'], 'and');
    expect(result).toEqual([
      {
        namespace: 'bookinfo',
        healthPromise: new Promise(() => {}),
        name: 'reviews',
        istioSidecar: false,
        labels: { app: 'reviews', service: 'reviews', version: 'v1,v2,v3' },
        istioReferences: []
      }
    ]);
  });

  it('check Label Filter with WorkloadList and OR Operation', () => {
    const result = filterByLabel(workloadList, ['app', 'version:v1']);
    expect(result).toEqual(workloadList);
  });

  it('check Label Filter with WorkloadList and AND Operation', () => {
    const result = filterByLabel(workloadList, ['app:reviews', 'version'], 'and');
    expect(result).toEqual([
      {
        namespace: 'bookinfo',
        healthPromise: new Promise(() => {}),
        name: 'reviews-v1',
        type: 'Deployment',
        istioSidecar: false,
        labels: { app: 'reviews', version: 'v1' },
        appLabel: true,
        versionLabel: true,
        istioReferences: [],
        notCoveredAuthPolicy: false
      },
      {
        namespace: 'bookinfo',
        healthPromise: new Promise(() => {}),
        name: 'reviews-v2',
        type: 'Deployment',
        istioSidecar: false,
        labels: { app: 'reviews', version: 'v2' },
        appLabel: true,
        versionLabel: true,
        istioReferences: [],
        notCoveredAuthPolicy: false
      },
      {
        namespace: 'bookinfo',
        healthPromise: new Promise(() => {}),
        name: 'reviews-v3',
        type: 'Deployment',
        istioSidecar: false,
        labels: { app: 'reviews', version: 'v3' },
        appLabel: true,
        versionLabel: true,
        istioReferences: [],
        notCoveredAuthPolicy: false
      }
    ]);
  });

  it('check Label Filter with ServiceList and OR Operation', () => {
    const result = filterByLabel(serviceList, ['app', 'service:details']);
    expect(result).toEqual(serviceList);
  });

  it('check Label Filter with ServiceList and AND Operation', () => {
    const result = filterByLabel(serviceList, ['app', 'service:de'], 'and');
    expect(result).toEqual([
      {
        namespace: 'bookinfo',
        healthPromise: new Promise(() => {}),
        name: 'details',
        istioSidecar: false,
        labels: { app: 'details', service: 'details' },
        validation: { name: 'details', objectType: 'service', valid: true, checks: [] },
        istioReferences: [],
        kialiWizard: '',
        serviceRegistry: 'Kubernetes'
      }
    ]);
  });
});
