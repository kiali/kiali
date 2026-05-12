import * as React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { MeshInfraType, MeshNodeType } from 'types/Mesh';
import { Status } from 'types/IstioStatus';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import { serverConfig } from 'config';
import { renderNodeHeader, shouldRefreshData, renderHealthStatus, TargetPanelCommonProps } from '../TargetPanelCommon';

jest.mock('@patternfly/react-topology', () => ({
  Controller: jest.fn(),
  Node: jest.fn()
}));

jest.mock('store/ConfigStore', () => {
  const { createStore: cs } = (jest as any).requireActual('redux');
  const s = cs(() => ({}));
  return { store: s };
});

const minimalStore = createStore(() => ({
  globalState: { kiosk: '' },
  statusState: { status: {} }
}));

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }): React.ReactElement => (
  <Provider store={minimalStore}>
    <MemoryRouter>{children}</MemoryRouter>
  </Provider>
);

const makeNodeData = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'test-node-1',
  cluster: 'cluster-a',
  infraName: 'istiod',
  infraType: MeshInfraType.ISTIOD as string,
  namespace: 'istio-system',
  nodeType: MeshNodeType.Infra as string,
  isAmbient: false,
  ...overrides
});

describe('TargetPanelCommon', () => {
  describe('renderNodeHeader', () => {
    it('shows AmbientLabel when ambientEnabled, infraType is ISTIOD, and isAmbient is true', () => {
      const savedAmbient = serverConfig.ambientEnabled;
      serverConfig.ambientEnabled = true;
      try {
        const data = makeNodeData({ isAmbient: true }) as any;
        const { getAllByText } = render(<>{renderNodeHeader(data)}</>, { wrapper: Wrapper });
        expect(getAllByText('ambient').length).toBeGreaterThan(0);
      } finally {
        serverConfig.ambientEnabled = savedAmbient;
      }
    });

    it('does not show AmbientLabel when isAmbient is false', () => {
      const savedAmbient = serverConfig.ambientEnabled;
      serverConfig.ambientEnabled = true;
      try {
        const data = makeNodeData({ isAmbient: false }) as any;
        const { container } = render(<>{renderNodeHeader(data)}</>, { wrapper: Wrapper });
        expect(container.textContent).not.toContain('ambient');
      } finally {
        serverConfig.ambientEnabled = savedAmbient;
      }
    });

    it('does not show AmbientLabel when ambientEnabled is false even if isAmbient is true', () => {
      const savedAmbient = serverConfig.ambientEnabled;
      serverConfig.ambientEnabled = false;
      try {
        const data = makeNodeData({ isAmbient: true }) as any;
        const { container } = render(<>{renderNodeHeader(data)}</>, { wrapper: Wrapper });
        expect(container.textContent).not.toContain('ambient');
      } finally {
        serverConfig.ambientEnabled = savedAmbient;
      }
    });

    it('does not show AmbientLabel for non-ISTIOD infraType even when ambient conditions are met', () => {
      const savedAmbient = serverConfig.ambientEnabled;
      serverConfig.ambientEnabled = true;
      try {
        const data = makeNodeData({
          isAmbient: true,
          infraType: MeshInfraType.GRAFANA,
          infraName: 'grafana'
        }) as any;
        const { container } = render(<>{renderNodeHeader(data)}</>, { wrapper: Wrapper });
        expect(container.textContent).not.toContain('ambient');
      } finally {
        serverConfig.ambientEnabled = savedAmbient;
      }
    });

    it('renders the infraName in the header', () => {
      const data = makeNodeData({ infraName: 'my-istiod' }) as any;
      const { getByText } = render(<>{renderNodeHeader(data)}</>, { wrapper: Wrapper });
      expect(getByText('my-istiod')).toBeTruthy();
    });

    it('renders namespace and cluster when nameOnly is false', () => {
      const data = makeNodeData({
        namespace: 'custom-ns',
        cluster: 'custom-cluster'
      }) as any;
      const { getByText } = render(<>{renderNodeHeader(data, { nameOnly: false })}</>, { wrapper: Wrapper });
      expect(getByText('custom-ns')).toBeTruthy();
      expect(getByText('custom-cluster')).toBeTruthy();
    });

    it('does not render namespace/cluster when nameOnly is true', () => {
      const data = makeNodeData({
        namespace: 'hidden-ns',
        cluster: 'hidden-cluster'
      }) as any;
      const { container } = render(<>{renderNodeHeader(data, { nameOnly: true })}</>, { wrapper: Wrapper });
      expect(container.textContent).not.toContain('hidden-ns');
      expect(container.textContent).not.toContain('hidden-cluster');
    });
  });

  describe('renderHealthStatus', () => {
    it('returns null for CLUSTER infraType', () => {
      const data = makeNodeData({ infraType: MeshInfraType.CLUSTER }) as any;
      const result = renderHealthStatus(data);
      expect(result).toBeNull();
    });

    it('returns null for DATAPLANE infraType', () => {
      const data = makeNodeData({ infraType: MeshInfraType.DATAPLANE }) as any;
      const result = renderHealthStatus(data);
      expect(result).toBeNull();
    });

    it('renders health indicator when healthData is present', () => {
      const data = makeNodeData({ healthData: Status.Healthy }) as any;
      const { container } = render(<>{renderHealthStatus(data)}</>);
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('shouldRefreshData', () => {
    const makeProps = (overrides: Partial<TargetPanelCommonProps> = {}): TargetPanelCommonProps =>
      ({
        duration: 60,
        istioAPIEnabled: true,
        kiosk: '',
        meshData: { names: [], elements: { nodes: [], edges: [] }, timestamp: 0 },
        refreshInterval: 15000,
        target: { elem: {} },
        updateTime: 1000,
        ...overrides
      } as any);

    it('returns true when updateTime changes', () => {
      const prev = makeProps({ updateTime: 1000 });
      const next = makeProps({ updateTime: 2000 });
      expect(shouldRefreshData(prev, next)).toBe(true);
    });

    it('returns false when nothing changes', () => {
      const target = { elem: {} } as any;
      const prev = makeProps({ target, updateTime: 1000 });
      const next = makeProps({ target, updateTime: 1000 });
      expect(shouldRefreshData(prev, next)).toBe(false);
    });

    it('returns true when target.elem changes to a new reference', () => {
      const prev = makeProps({ target: { elem: {} } as any, updateTime: 1000 });
      const next = makeProps({ target: { elem: {} } as any, updateTime: 1000 });
      expect(shouldRefreshData(prev, next)).toBe(true);
    });

    it('returns truthy when going from no target to having a target', () => {
      const prev = makeProps({ target: undefined as any, updateTime: 1000 });
      const next = makeProps({ target: { elem: {} } as any, updateTime: 1000 });
      expect(shouldRefreshData(prev, next)).toBeTruthy();
    });
  });
});
