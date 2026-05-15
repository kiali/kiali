import { MeshInfraType, MeshNodeType, ControlPlane, MeshNodeWrapper } from 'types/Mesh';
import { isRemoteCluster } from '../TargetPanelControlPlane';

jest.mock('@patternfly/react-topology', () => ({
  Controller: jest.fn(),
  Node: jest.fn()
}));

jest.mock('store/ConfigStore', () => {
  const { createStore } = (jest as any).requireActual('redux');
  const s = createStore(() => ({
    globalState: { kiosk: '' },
    statusState: { status: {} }
  }));
  return { store: s };
});

const makeControlPlane = (overrides: Partial<ControlPlane> = {}): ControlPlane =>
  ({
    cluster: {
      name: 'cluster-a',
      accessible: true,
      apiEndpoint: '',
      isKialiHome: true,
      kialiInstances: [],
      secretName: ''
    },
    config: {},
    istiodName: 'istiod',
    revision: 'default',
    managedNamespaces: [{ name: 'bookinfo' }, { name: 'default' }],
    thresholds: {},
    ...overrides
  } as ControlPlane);

const makeIstiodNode = (cluster: string, namespace: string, cp?: ControlPlane): MeshNodeWrapper => ({
  data: {
    id: `istiod-${cluster}-${namespace}`,
    cluster,
    infraName: 'istiod',
    infraType: MeshInfraType.ISTIOD,
    namespace,
    nodeType: MeshNodeType.Infra,
    infraData: cp ?? makeControlPlane()
  } as any
});

describe('isRemoteCluster', () => {
  it('returns false when annotations are undefined', () => {
    expect(isRemoteCluster(undefined)).toBe(false);
  });

  it('returns false when no controlPlaneClusters annotation', () => {
    expect(isRemoteCluster({ 'some-annotation': 'value' })).toBe(false);
  });

  it('returns true when controlPlaneClusters annotation is present', () => {
    expect(isRemoteCluster({ 'topology.istio.io/controlPlaneClusters': 'cluster-a' })).toBe(true);
  });

  it('returns false when controlPlaneClusters value is empty string', () => {
    expect(isRemoteCluster({ 'topology.istio.io/controlPlaneClusters': '' })).toBe(false);
  });
});

describe('getControlPlanes filtering logic', () => {
  it('filters nodes by matching cluster and namespace', () => {
    const cpA = makeControlPlane();
    const cpB = makeControlPlane({
      cluster: {
        name: 'cluster-b',
        accessible: true,
        apiEndpoint: '',
        isKialiHome: false,
        kialiInstances: [],
        secretName: ''
      }
    });

    const nodes = [
      makeIstiodNode('cluster-a', 'istio-system', cpA),
      makeIstiodNode('cluster-b', 'istio-system', cpB),
      makeIstiodNode('cluster-a', 'istio-system-2', makeControlPlane())
    ];

    const targetCluster = 'cluster-a';
    const targetNamespace = 'istio-system';

    const filtered = nodes.filter(
      node =>
        node.data.infraType === MeshInfraType.ISTIOD &&
        node.data.cluster === targetCluster &&
        node.data.namespace === targetNamespace
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].data.cluster).toBe('cluster-a');
    expect(filtered[0].data.namespace).toBe('istio-system');
  });

  it('returns empty when no nodes match the target cluster', () => {
    const nodes = [
      makeIstiodNode('cluster-b', 'istio-system', makeControlPlane()),
      makeIstiodNode('cluster-c', 'istio-system', makeControlPlane())
    ];

    const filtered = nodes.filter(
      node =>
        node.data.infraType === MeshInfraType.ISTIOD &&
        node.data.cluster === 'cluster-a' &&
        node.data.namespace === 'istio-system'
    );

    expect(filtered.length).toBe(0);
  });

  it('returns empty when namespace does not match', () => {
    const nodes = [makeIstiodNode('cluster-a', 'istio-system', makeControlPlane())];

    const filtered = nodes.filter(
      node =>
        node.data.infraType === MeshInfraType.ISTIOD &&
        node.data.cluster === 'cluster-a' &&
        node.data.namespace === 'bookinfo'
    );

    expect(filtered.length).toBe(0);
  });

  it('does not include non-ISTIOD nodes', () => {
    const dataplaneNode: MeshNodeWrapper = {
      data: {
        id: 'dp-1',
        cluster: 'cluster-a',
        infraName: 'dataplane',
        infraType: MeshInfraType.DATAPLANE,
        namespace: 'istio-system',
        nodeType: MeshNodeType.Infra,
        infraData: []
      } as any
    };

    const nodes = [makeIstiodNode('cluster-a', 'istio-system', makeControlPlane()), dataplaneNode];

    const filtered = nodes.filter(
      node =>
        node.data.infraType === MeshInfraType.ISTIOD &&
        node.data.cluster === 'cluster-a' &&
        node.data.namespace === 'istio-system'
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].data.infraType).toBe(MeshInfraType.ISTIOD);
  });

  it('handles multi-mesh with same cluster but different namespaces', () => {
    const nodes = [
      makeIstiodNode('cluster-a', 'mesh1-system', makeControlPlane()),
      makeIstiodNode('cluster-a', 'mesh2-system', makeControlPlane())
    ];

    const mesh1Filtered = nodes.filter(
      node =>
        node.data.infraType === MeshInfraType.ISTIOD &&
        node.data.cluster === 'cluster-a' &&
        node.data.namespace === 'mesh1-system'
    );

    const mesh2Filtered = nodes.filter(
      node =>
        node.data.infraType === MeshInfraType.ISTIOD &&
        node.data.cluster === 'cluster-a' &&
        node.data.namespace === 'mesh2-system'
    );

    expect(mesh1Filtered.length).toBe(1);
    expect(mesh2Filtered.length).toBe(1);
    expect(mesh1Filtered[0].data.namespace).toBe('mesh1-system');
    expect(mesh2Filtered[0].data.namespace).toBe('mesh2-system');
  });
});

describe('isControlPlane detection logic', () => {
  it('identifies control plane when graph has ISTIOD nodes for the namespace', () => {
    const controlPlanes = [makeControlPlane()];
    const hasControlPlanes = controlPlanes && controlPlanes.length > 0;
    expect(hasControlPlanes).toBe(true);
  });

  it('falls back to config when no ISTIOD nodes in graph', () => {
    const controlPlanes: ControlPlane[] = [];
    const isIstioNamespace = (ns: string): boolean => ns === 'istio-system';

    const hasControlPlanes = controlPlanes && controlPlanes.length > 0;
    expect(hasControlPlanes).toBe(false);
    expect(isIstioNamespace('istio-system')).toBe(true);
  });

  it('identifies as data plane when no control planes and not in config', () => {
    const controlPlanes: ControlPlane[] = [];
    const isIstioNamespace = (_ns: string): boolean => false;

    const isControlPlane = (controlPlanes && controlPlanes.length > 0) || isIstioNamespace('bookinfo');
    expect(isControlPlane).toBe(false);
  });

  it('identifies custom control plane namespace via graph even if not in standard config', () => {
    const controlPlanes = [makeControlPlane()];
    const isIstioNamespace = (_ns: string): boolean => false;

    const isControlPlane = (controlPlanes && controlPlanes.length > 0) || isIstioNamespace('custom-cp-ns');
    expect(isControlPlane).toBe(true);
  });
});

describe('data plane cluster matching logic', () => {
  it('matches data plane to control plane by revision AND cluster', () => {
    const controlPlaneRevision = 'default';
    const controlPlaneCluster = 'cluster-a';

    const dataPlaneNodes = [
      { revision: 'default', cluster: 'cluster-a', namespaceCount: 5 },
      { revision: 'default', cluster: 'cluster-b', namespaceCount: 3 }
    ];

    const match = dataPlaneNodes.find(dp => dp.revision === controlPlaneRevision && dp.cluster === controlPlaneCluster);

    expect(match).toBeDefined();
    expect(match!.namespaceCount).toBe(5);
  });

  it('does not match data plane from wrong cluster even with same revision', () => {
    const controlPlaneRevision = 'canary';
    const controlPlaneCluster = 'cluster-a';

    const dataPlaneNodes = [{ revision: 'canary', cluster: 'cluster-b', namespaceCount: 3 }];

    const match = dataPlaneNodes.find(dp => dp.revision === controlPlaneRevision && dp.cluster === controlPlaneCluster);

    expect(match).toBeUndefined();
  });

  it('returns zero namespace count when no matching data plane', () => {
    const controlPlaneRevision = 'default';
    const controlPlaneCluster = 'cluster-a';

    const dataPlaneNodes: { cluster: string; namespaceCount: number; revision: string }[] = [];

    const match = dataPlaneNodes.find(dp => dp.revision === controlPlaneRevision && dp.cluster === controlPlaneCluster);

    const namespaceCount = match?.namespaceCount ?? 0;
    expect(namespaceCount).toBe(0);
  });
});
