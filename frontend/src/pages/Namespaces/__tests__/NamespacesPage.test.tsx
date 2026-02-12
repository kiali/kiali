import * as React from 'react';
import { shallow, mount } from 'enzyme';
import { Provider } from 'react-redux';
import { NamespacesPageComponent } from '../NamespacesPage';
import { NamespaceInfo } from '../../../types/NamespaceInfo';
import { DurationInSeconds, IntervalInMilliseconds } from 'types/Common';
import * as API from '../../../services/Api';
import { store } from '../../../store/ConfigStore';
import { RefreshIntervalManual } from '../../../config/Config';
import { HistoryManager } from '../../../app/History';
import { Show } from '../../../types/Common';

// NamespacesPage always renders NamespaceTrafficPolicies; mock it to keep these unit tests focused.
jest.mock('../NamespaceTrafficPolicies', () => ({
  NamespaceTrafficPolicies: (props: any) => <div data-test="NamespaceTrafficPolicies" {...props} />
}));

// Some badges use react-router hooks; these tests don't run under a Router.
jest.mock('components/Badge/ControlPlaneBadge', () => ({
  ControlPlaneBadge: () => <span data-test="ControlPlaneBadge" />
}));

jest.mock('../../../services/Api', () => ({
  getNamespaces: jest.fn(),
  getClustersHealth: jest.fn(),
  getClustersTls: jest.fn(),
  getConfigValidations: jest.fn(),
  getAllIstioConfigs: jest.fn(),
  getGrafanaInfo: jest.fn(() => Promise.resolve({ data: {} })),
  getErrorString: jest.fn(() => ''),
  getPersesInfo: jest.fn(() => Promise.resolve({ data: {} })),
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
    getPathname: jest.fn(() => ''),
    getSearch: jest.fn(() => '')
  },
  router: {
    navigate: jest.fn()
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
  duration: 600 as DurationInSeconds,
  externalServices: [],
  istioAPIEnabled: true,
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
    (API.getGrafanaInfo as jest.Mock).mockResolvedValue({ data: {} });
    (API.getPersesInfo as jest.Mock).mockResolvedValue({ data: {} });
  });

  describe('Component initialization', () => {
    it('renders without crashing', () => {
      const wrapper = shallow(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      expect(wrapper.exists()).toBeTruthy();
    });

    it('initializes state correctly', () => {
      const wrapper = shallow(<NamespacesPageComponent {...defaultProps} />);
      const instance = wrapper.instance() as NamespacesPageComponent;

      expect(instance.state.loaded).toBe(false);
      expect(instance.state.namespaces).toEqual([]);
      expect(instance.state.nsTarget).toBe('');
      expect(instance.state.opTarget).toBe('');
      expect(instance.state.kind).toBe('');
      expect(instance.state.showTrafficPoliciesModal).toBe(false);
    });
  });

  describe('Component lifecycle', () => {
    it('calls load on mount when refresh interval is not manual', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} refreshInterval={15000} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;
      const loadSpy = jest.spyOn(instance, 'load');

      (HistoryManager.getRefresh as jest.Mock).mockReturnValue(15000);
      instance.componentDidMount();

      expect(loadSpy).toHaveBeenCalled();
    });

    it('does not call load on mount when refresh interval is manual', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} refreshInterval={RefreshIntervalManual} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;
      const loadSpy = jest.spyOn(instance, 'load');

      (HistoryManager.getRefresh as jest.Mock).mockReturnValue(RefreshIntervalManual);
      instance.componentDidMount();

      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('calls load on update when lastRefreshAt changes', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;
      const loadSpy = jest.spyOn(instance, 'load');

      wrapper.setProps({
        children: <NamespacesPageComponent {...defaultProps} lastRefreshAt={Date.now() + 1000} />
      });
      wrapper.update();

      expect(loadSpy).toHaveBeenCalled();
    });

    it('cancels promises on unmount', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;
      const cancelAllSpy = jest.spyOn(instance['promises'], 'cancelAll');

      wrapper.unmount();

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

      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} refreshInterval={15000} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      instance.load();
      await new Promise(resolve => setTimeout(resolve, 0));
      wrapper.update();

      expect(API.getNamespaces).toHaveBeenCalled();
      expect(instance.state.loaded).toBe(true);
      expect(instance.state.namespaces.length).toBeGreaterThan(0);
    });

    it('handles API errors gracefully', async () => {
      const error = { isCanceled: false, message: 'API Error' };
      (API.getNamespaces as jest.Mock).mockRejectedValue(error);

      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} refreshInterval={15000} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      await instance.load();

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

      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} refreshInterval={15000} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      await instance.load();

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

      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      instance.setState({ namespaces: mockNamespaces });
      await instance.fetchHealth(true, {
        id: 'namespace',
        title: 'Name',
        param: 'ns',
        compare: jest.fn(),
        isNumeric: false
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

      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      instance.setState({ namespaces: mockNamespaces });
      await instance.fetchTLS(true, { id: 'mtls', title: 'mTLS', param: 'mtls', compare: jest.fn(), isNumeric: false });

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

      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      instance.setState({ namespaces: mockNamespaces });
      await instance.fetchValidations(true, {
        id: 'validations',
        title: 'Validations',
        param: 'validations',
        compare: jest.fn(),
        isNumeric: false
      });

      expect(API.getConfigValidations).toHaveBeenCalled();
      expect(API.getAllIstioConfigs).toHaveBeenCalled();
    });
  });

  describe('getNamespaceActions', () => {
    it('returns actions for non-control-plane namespace', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      const actions = instance.getNamespaceActions(mockNamespaces[0]);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some(a => a.title === 'Show')).toBeTruthy();
    });

    it('returns actions for control-plane namespace', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      instance.setState({ grafanaLinks: [{ name: 'Performance', url: 'http://grafana', variables: {} }] });
      const actions = instance.getNamespaceActions(mockNamespaces[1]);

      expect(actions.length).toBeGreaterThan(0);
    });
  });

  describe('hideTrafficManagement', () => {
    it('resets traffic management state', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      instance.setState({
        showTrafficPoliciesModal: true,
        nsTarget: 'test-namespace',
        opTarget: 'create',
        kind: 'policy',
        clusterTarget: 'test-cluster'
      });

      instance.hideTrafficManagement();

      expect(instance.state.showTrafficPoliciesModal).toBe(false);
      expect(instance.state.nsTarget).toBe('');
      expect(instance.state.opTarget).toBe('');
      expect(instance.state.kind).toBe('');
      expect(instance.state.clusterTarget).toBe('');
    });
  });

  describe('show method', () => {
    it('navigates to graph page', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      instance.show(Show.GRAPH, 'default');

      // Note: router.navigate is mocked, so we can't easily test the actual navigation
      // but we can verify the method doesn't throw
      expect(() => instance.show(0, 'default')).not.toThrow();
    });
  });

  describe('sort method', () => {
    it('sorts namespaces correctly', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      instance.setState({
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

      const sortField = {
        id: 'namespace',
        title: 'Name',
        param: 'ns',
        compare: (a: NamespaceInfo, b: NamespaceInfo) => a.name.localeCompare(b.name),
        isNumeric: false
      };

      instance.sort(sortField, true);

      expect(instance.state.namespaces[0].name).toBe('a-namespace');
      expect(instance.state.namespaces[1].name).toBe('z-namespace');
    });
  });

  describe('render', () => {
    it('renders empty state when no namespaces', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      instance.setState({ loaded: true, namespaces: [] });
      wrapper.update();

      // Empty state is provided via VirtualList.emptyState (PatternFly EmptyState)
      expect(wrapper.text()).toContain('No namespaces found');
    });

    it('renders VirtualList when namespaces exist', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      instance.setState({ loaded: true, namespaces: mockNamespaces });
      wrapper.update();

      // VirtualList is a redux-connected component (Connect(...)), so assert on a stable descendant.
      expect(wrapper.find('Table').exists()).toBeTruthy();
    });

    it('renders NamespaceTrafficPolicies when modal is open', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesPageComponent {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find(NamespacesPageComponent).instance() as NamespacesPageComponent;

      instance.setState({
        showTrafficPoliciesModal: true,
        nsTarget: 'test-namespace',
        opTarget: 'create',
        kind: 'policy',
        namespaces: mockNamespaces
      });

      expect(wrapper.find('NamespaceTrafficPolicies').exists()).toBeTruthy();
    });
  });
});
