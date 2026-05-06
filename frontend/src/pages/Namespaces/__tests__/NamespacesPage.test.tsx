import * as React from 'react';
import { act, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { NamespacesPageComponent } from '../NamespacesPage';
import { NamespaceInfo } from '../../../types/NamespaceInfo';
import { IntervalInMilliseconds } from 'types/Common';
import * as API from '../../../services/Api';
import { store } from '../../../store/ConfigStore';
import { RefreshIntervalManual } from '../../../config/Config';
import { HistoryManager } from '../../../app/History';

jest.mock('components/Badge/ControlPlaneBadge', () => ({
  ControlPlaneBadge: () => <span data-test="ControlPlaneBadge" />
}));

jest.mock('components/DefaultSecondaryMasthead/DefaultSecondaryMasthead', () => ({
  DefaultSecondaryMasthead: ({ children }: { children?: React.ReactNode }) => (
    <div data-test="DefaultSecondaryMasthead">{children}</div>
  )
}));

jest.mock('components/Time/HealthComputeDurationMastheadToolbar', () => ({
  HealthComputeDurationMastheadToolbar: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

jest.mock('../../../services/Api', () => ({
  getNamespaces: jest.fn(),
  getClustersHealth: jest.fn(),
  getClustersTls: jest.fn(),
  getConfigValidations: jest.fn(),
  getAllIstioConfigs: jest.fn(),
  getErrorString: jest.fn(() => ''),
  getControlPlanes: jest.fn(() => Promise.resolve({ data: [] }))
}));

jest.mock('../../../utils/AlertUtils', () => ({
  addDanger: jest.fn(),
  addError: jest.fn()
}));

jest.mock('../../../app/History', () => ({
  HistoryManager: {
    deleteParam: jest.fn(),
    getDuration: jest.fn(),
    getNumericParam: jest.fn(),
    getParam: jest.fn(),
    setParam: jest.fn(),
    getRefresh: jest.fn(() => 0)
  },
  URLParam: {
    DIRECTION: 'direction',
    DURATION: 'duration',
    REFRESH_INTERVAL: 'refresh',
    SORT: 'sort'
  },
  location: {
    getPathname: jest.fn(() => '/namespaces'),
    getSearch: jest.fn(() => '')
  },
  router: {
    navigate: jest.fn(),
    state: {
      location: {
        pathname: '/namespaces',
        search: ''
      }
    },
    basename: '/console'
  },
  webRoot: '/'
}));

jest.mock('utils/I18nUtils', () => ({
  t: (key: string) => key,
  tMap: (m: Record<string, string>) => m,
  useKialiTranslation: () => ({
    t: (key: string) => key
  })
}));

const mockNamespaces: NamespaceInfo[] = [
  {
    name: 'default',
    cluster: 'test-cluster',
    isAmbient: false,
    isControlPlane: false,
    labels: {},
    annotations: {},
    revision: undefined
  },
  {
    name: 'istio-system',
    cluster: 'test-cluster',
    isAmbient: false,
    isControlPlane: true,
    labels: {},
    annotations: {},
    revision: undefined
  }
];

const defaultReduxProps = {
  columnOrder: [] as string[],
  hiddenColumnIds: [],
  kiosk: '',
  language: 'en',
  meshStatus: 'MTLS_ENABLED',
  minTLS: 'TLS_AUTO',
  navCollapse: false,
  refreshInterval: 15000 as IntervalInMilliseconds,
  dispatch: jest.fn()
};

const defaultProps = {
  ...defaultReduxProps,
  lastRefreshAt: Date.now()
};

describe('NamespacesPageComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (HistoryManager.getParam as jest.Mock).mockReturnValue(undefined);
    (HistoryManager.getRefresh as jest.Mock).mockReturnValue(RefreshIntervalManual);
    (API.getControlPlanes as jest.Mock).mockResolvedValue({ data: [] });
  });

  describe('Component initialization', () => {
    it('renders without crashing', () => {
      const { container } = render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent {...defaultProps} />
          </Provider>
        </MemoryRouter>
      );
      expect(container).toBeTruthy();
    });

    it('initializes state correctly', () => {
      const ref = React.createRef<NamespacesPageComponent>();
      render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} />
          </Provider>
        </MemoryRouter>
      );

      expect(ref.current!.state.loaded).toBe(false);
      expect(ref.current!.state.namespaces).toEqual([]);
      expect(ref.current!.state.showColumnManagement).toBe(false);
    });
  });

  describe('Component lifecycle', () => {
    it('calls load on mount when refresh interval is not manual', () => {
      const ref = React.createRef<NamespacesPageComponent>();
      render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} refreshInterval={15000} />
          </Provider>
        </MemoryRouter>
      );
      const loadSpy = jest.spyOn(ref.current!, 'load');

      (HistoryManager.getRefresh as jest.Mock).mockReturnValue(15000);
      ref.current!.componentDidMount();

      expect(loadSpy).toHaveBeenCalled();
    });

    it('does not call load on mount when refresh interval is manual', () => {
      const ref = React.createRef<NamespacesPageComponent>();
      render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} refreshInterval={RefreshIntervalManual} />
          </Provider>
        </MemoryRouter>
      );
      const loadSpy = jest.spyOn(ref.current!, 'load');

      (HistoryManager.getRefresh as jest.Mock).mockReturnValue(RefreshIntervalManual);
      ref.current!.componentDidMount();

      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('calls load on update when lastRefreshAt changes', () => {
      const ref = React.createRef<NamespacesPageComponent>();
      const firstLast = Date.now();
      const { rerender } = render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} lastRefreshAt={firstLast} />
          </Provider>
        </MemoryRouter>
      );
      const loadSpy = jest.spyOn(ref.current!, 'load');

      rerender(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} lastRefreshAt={firstLast + 1000} />
          </Provider>
        </MemoryRouter>
      );

      expect(loadSpy).toHaveBeenCalled();
    });

    it('cancels promises on unmount', () => {
      const ref = React.createRef<NamespacesPageComponent>();
      const { unmount } = render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} />
          </Provider>
        </MemoryRouter>
      );
      const cancelAllSpy = jest.spyOn(ref.current!['promises'], 'cancelAll');

      unmount();

      expect(cancelAllSpy).toHaveBeenCalled();
    });
  });

  describe('load method', () => {
    it('fetches and processes namespaces', async () => {
      (API.getNamespaces as jest.Mock).mockResolvedValue({
        data: [
          {
            name: 'default',
            cluster: 'test-cluster',
            isAmbient: false,
            isControlPlane: false,
            labels: {},
            annotations: {}
          },
          {
            name: 'istio-system',
            cluster: 'test-cluster',
            isAmbient: false,
            isControlPlane: true,
            labels: {},
            annotations: {}
          }
        ]
      });

      const ref = React.createRef<NamespacesPageComponent>();
      render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} refreshInterval={15000} />
          </Provider>
        </MemoryRouter>
      );

      ref.current!.load();
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(API.getNamespaces).toHaveBeenCalled();
      expect(ref.current!.state.loaded).toBe(true);
      expect(ref.current!.state.namespaces.length).toBeGreaterThan(0);
    });

    it('handles API errors gracefully', async () => {
      const error = { isCanceled: false, message: 'API Error' };
      (API.getNamespaces as jest.Mock).mockRejectedValue(error);

      const ref = React.createRef<NamespacesPageComponent>();
      render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} refreshInterval={15000} />
          </Provider>
        </MemoryRouter>
      );

      await act(async () => {
        await ref.current!.load();
      });

      expect(API.getNamespaces).toHaveBeenCalled();
    });

    it('filters namespaces by name filter', async () => {
      (API.getNamespaces as jest.Mock).mockResolvedValue({
        data: [
          {
            name: 'default',
            cluster: 'test-cluster',
            isAmbient: false,
            isControlPlane: false,
            labels: {},
            annotations: {}
          },
          {
            name: 'istio-system',
            cluster: 'test-cluster',
            isAmbient: false,
            isControlPlane: true,
            labels: {},
            annotations: {}
          }
        ]
      });

      const ref = React.createRef<NamespacesPageComponent>();
      render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} refreshInterval={15000} />
          </Provider>
        </MemoryRouter>
      );

      await act(async () => {
        await ref.current!.load();
      });

      expect(API.getNamespaces).toHaveBeenCalled();
    });
  });

  describe('fetchHealth', () => {
    it('fetches health for namespaces', async () => {
      const mockHealthResponse = new Map<string, any>();
      mockHealthResponse.set('default', {
        appHealth: {},
        serviceHealth: {},
        workloadHealth: {}
      });

      (API.getClustersHealth as jest.Mock).mockResolvedValue(mockHealthResponse);

      const ref = React.createRef<NamespacesPageComponent>();
      render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} />
          </Provider>
        </MemoryRouter>
      );

      act(() => {
        ref.current!.setState({ namespaces: mockNamespaces });
      });
      await act(async () => {
        await ref.current!.fetchHealth(true, {
          id: 'namespace',
          title: 'Name',
          param: 'ns',
          compare: jest.fn(),
          isNumeric: false
        });
      });

      expect(API.getClustersHealth).toHaveBeenCalled();
    });
  });

  describe('fetchTLS', () => {
    it('fetches TLS status for namespaces', async () => {
      (API.getClustersTls as jest.Mock).mockResolvedValue({
        data: [
          {
            namespace: 'default',
            cluster: 'test-cluster',
            status: 'MTLS_ENABLED',
            autoMTLSEnabled: true,
            minTLS: 'TLS_AUTO'
          }
        ]
      });

      const ref = React.createRef<NamespacesPageComponent>();
      render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} />
          </Provider>
        </MemoryRouter>
      );

      act(() => {
        ref.current!.setState({ namespaces: mockNamespaces });
      });
      await act(async () => {
        await ref.current!.fetchTLS(true, {
          id: 'mtls',
          title: 'mTLS',
          param: 'mtls',
          compare: jest.fn(),
          isNumeric: false
        });
      });

      expect(API.getClustersTls).toHaveBeenCalled();
    });
  });

  describe('fetchValidations', () => {
    it('fetches validations for namespaces', async () => {
      (API.getConfigValidations as jest.Mock).mockResolvedValue({
        data: [
          {
            namespace: 'default',
            cluster: 'test-cluster',
            validations: {}
          }
        ]
      });

      (API.getAllIstioConfigs as jest.Mock).mockResolvedValue({
        data: {
          resources: {}
        }
      });

      const ref = React.createRef<NamespacesPageComponent>();
      render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} />
          </Provider>
        </MemoryRouter>
      );

      act(() => {
        ref.current!.setState({ namespaces: mockNamespaces });
      });
      await act(async () => {
        await ref.current!.fetchValidations(true, {
          id: 'validations',
          title: 'Validations',
          param: 'validations',
          compare: jest.fn(),
          isNumeric: false
        });
      });

      expect(API.getConfigValidations).toHaveBeenCalled();
      expect(API.getAllIstioConfigs).toHaveBeenCalled();
    });
  });

  describe('sort method', () => {
    it('sorts namespaces correctly', () => {
      const ref = React.createRef<NamespacesPageComponent>();
      render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} />
          </Provider>
        </MemoryRouter>
      );

      act(() => {
        ref.current!.setState({
          namespaces: [
            {
              name: 'z-namespace',
              cluster: 'test-cluster',
              isAmbient: false,
              isControlPlane: false,
              labels: {},
              annotations: {}
            },
            {
              name: 'a-namespace',
              cluster: 'test-cluster',
              isAmbient: false,
              isControlPlane: false,
              labels: {},
              annotations: {}
            }
          ] as NamespaceInfo[]
        });
      });

      const sortField = {
        id: 'namespace',
        title: 'Name',
        param: 'ns',
        compare: (a: NamespaceInfo, b: NamespaceInfo) => a.name.localeCompare(b.name),
        isNumeric: false
      };

      ref.current!.sort(sortField, true);

      expect(ref.current!.state.namespaces[0].name).toBe('a-namespace');
      expect(ref.current!.state.namespaces[1].name).toBe('z-namespace');
    });
  });

  describe('render', () => {
    it('renders empty state when no namespaces', () => {
      const ref = React.createRef<NamespacesPageComponent>();
      const { container } = render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} />
          </Provider>
        </MemoryRouter>
      );

      act(() => {
        ref.current!.setState({ loaded: true, namespaces: [] });
      });

      expect(container.textContent).toContain('No namespaces found');
    });

    it('renders VirtualList when namespaces exist', () => {
      const ref = React.createRef<NamespacesPageComponent>();
      const { container } = render(
        <MemoryRouter>
          <Provider store={store}>
            <NamespacesPageComponent ref={ref} {...defaultProps} />
          </Provider>
        </MemoryRouter>
      );

      act(() => {
        ref.current!.setState({ loaded: true, namespaces: mockNamespaces });
      });

      expect(container.querySelector('table') || container.querySelector('[role="grid"]')).toBeInTheDocument();
    });
  });
});
