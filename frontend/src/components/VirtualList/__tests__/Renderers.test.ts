/* eslint-disable import/first */
import { InstanceType } from '../../../types/Common';

rstest.mock('store/ConfigStore', () => ({
  store: {
    getState: () => ({ globalState: { kiosk: '' } }),
    dispatch: rstest.fn(),
    subscribe: rstest.fn(),
    replaceReducer: rstest.fn()
  },
  persistor: { persist: rstest.fn() }
}));

rstest.mock('config/ServerConfig', () => ({
  isMultiCluster: false,
  serverConfig: { ambientEnabled: false }
}));

import { getKioskParamsForListItem } from '../Renderers';
import { Resource, TResource } from '../Config';
import { WorkloadListItem } from '../../../types/Workload';

const workloadConfig: Resource = { name: 'workloads', columns: [] };
const serviceConfig: Resource = { name: 'services', columns: [] };
const appConfig: Resource = { name: 'applications', columns: [] };

const baseWorkload: WorkloadListItem = {
  appLabel: true,
  cluster: 'default',
  gvk: { Group: 'apps', Version: 'v1', Kind: 'Deployment' },
  health: {} as any,
  instanceType: InstanceType.Workload,
  isAmbient: false,
  isGateway: false,
  isWaypoint: false,
  isZtunnel: false,
  istioReferences: [],
  istioSidecar: true,
  labels: {},
  name: 'my-workload',
  namespace: 'bookinfo',
  versionLabel: true
};

describe('getKioskParamsForListItem', () => {
  it('returns type param for workloads with gvk', () => {
    expect(getKioskParamsForListItem(baseWorkload, workloadConfig)).toBe('type=Deployment');
  });

  it('encodes Kind values correctly', () => {
    const workload: WorkloadListItem = {
      ...baseWorkload,
      gvk: { Group: 'apps', Version: 'v1', Kind: 'ReplicaSet' }
    };
    expect(getKioskParamsForListItem(workload, workloadConfig)).toBe('type=ReplicaSet');
  });

  it('returns type=External for external services', () => {
    const externalService = ({
      name: 'ext-svc',
      namespace: 'bookinfo',
      serviceRegistry: 'External'
    } as unknown) as TResource;

    expect(getKioskParamsForListItem(externalService, serviceConfig)).toBe('type=External');
  });

  it('returns undefined for regular services', () => {
    const regularService = ({
      name: 'productpage',
      namespace: 'bookinfo',
      serviceRegistry: 'Kubernetes'
    } as unknown) as TResource;

    expect(getKioskParamsForListItem(regularService, serviceConfig)).toBeUndefined();
  });

  it('returns undefined for applications', () => {
    const app = ({
      name: 'my-app',
      namespace: 'bookinfo'
    } as unknown) as TResource;

    expect(getKioskParamsForListItem(app, appConfig)).toBeUndefined();
  });

  it('returns undefined for workloads config with items missing gvk', () => {
    const itemWithoutGvk = ({
      name: 'my-item',
      namespace: 'bookinfo'
    } as unknown) as TResource;

    expect(getKioskParamsForListItem(itemWithoutGvk, workloadConfig)).toBeUndefined();
  });
});
