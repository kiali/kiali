import * as React from 'react';
import { shallow, mount, ReactWrapper } from 'enzyme';
import { NamespaceTrafficPolicies } from '../NamespaceTrafficPolicies';
import { NamespaceInfo } from '../../../types/NamespaceInfo';
import { ControlPlane } from '../../../types/Mesh';
import { DurationInSeconds } from 'types/Common';
import * as API from 'services/Api';
import { getGVKTypeString } from '../../../utils/IstioConfigUtils';
import { gvkType } from '../../../types/IstioConfigList';

jest.mock('services/Api', () => ({
  getIstioPermissions: jest.fn(() => Promise.resolve({ data: {} })),
  updateNamespace: jest.fn(() => Promise.resolve({})),
  deleteIstioConfigDetail: jest.fn(() => Promise.resolve({})),
  createIstioConfigDetail: jest.fn(() => Promise.resolve({}))
}));

// Avoid pulling in the full preview/editor stack (react-ace + redux-connected components) in these unit tests.
jest.mock('components/IstioConfigPreview/IstioConfigPreview', () => ({
  IstioConfigPreview: (props: any) => <div data-test="IstioConfigPreview" {...props} />,
  // Exported to satisfy named import; not needed for these tests.
  ConfigPreviewItem: {}
}));

jest.mock('services/GraphDataSource', () => ({
  GraphDataSource: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    fetchForNamespace: jest.fn()
  }))
}));

jest.mock('utils/AlertUtils', () => ({
  addDanger: jest.fn(),
  addError: jest.fn(),
  addSuccess: jest.fn()
}));

const mockNamespaceInfo: NamespaceInfo = {
  name: 'test-namespace',
  cluster: 'test-cluster',
  isAmbient: false,
  isControlPlane: false,
  labels: {},
  annotations: {},
  revision: undefined,
  istioConfig: {
    permissions: {},
    resources: {},
    validations: {}
  }
};

const defaultProps = {
  controlPlanes: [] as ControlPlane[],
  duration: 600 as DurationInSeconds,
  hideConfirmModal: jest.fn(),
  isOpen: true,
  kind: 'policy',
  load: jest.fn(),
  nsInfo: mockNamespaceInfo,
  nsTarget: 'test-namespace',
  opTarget: 'create'
};

const mountWrapper = (props = defaultProps): ReactWrapper => mount(<NamespaceTrafficPolicies {...props} />);

describe('NamespaceTrafficPolicies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component initialization', () => {
    it('renders without crashing', () => {
      const wrapper = shallow(<NamespaceTrafficPolicies {...defaultProps} />);
      expect(wrapper.exists()).toBeTruthy();
    });

    it('initializes state correctly for create operation', () => {
      const wrapper = shallow(<NamespaceTrafficPolicies {...defaultProps} opTarget="create" />);
      const instance = wrapper.instance() as NamespaceTrafficPolicies;
      expect(instance.state.loaded).toBe(false);
      expect(instance.state.disableOp).toBe(true);
      expect(instance.state.confirmationModal).toBe(false);
    });

    it('initializes state correctly for update operation', () => {
      const wrapper = shallow(<NamespaceTrafficPolicies {...defaultProps} opTarget="update" />);
      const instance = wrapper.instance() as NamespaceTrafficPolicies;
      expect(instance.state.loaded).toBe(true);
      expect(instance.state.disableOp).toBe(true);
    });

    it('initializes state correctly for canary kind', () => {
      const wrapper = shallow(<NamespaceTrafficPolicies {...defaultProps} kind="canary" opTarget="revision-1" />);
      const instance = wrapper.instance() as NamespaceTrafficPolicies;
      expect(instance.state.selectedRevision).toBe('revision-1');
    });
  });

  describe('Modal rendering', () => {
    it('renders confirmation modal for injection kind', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'injection', opTarget: 'enable' });
      wrapper.setState({ confirmationModal: true, disableOp: false });
      wrapper.update();

      expect(wrapper.find('Modal').exists()).toBeTruthy();
      expect(wrapper.find('Modal').prop('title')).toContain('Enable Auto Injection');
    });

    it('renders confirmation modal for ambient kind', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'ambient', opTarget: 'enable' });
      wrapper.setState({ confirmationModal: true, disableOp: false });
      wrapper.update();

      expect(wrapper.find('Modal').exists()).toBeTruthy();
      expect(wrapper.find('Modal').prop('title')).toContain('Enable Ambient');
    });

    it('renders confirmation modal for canary kind', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'canary', opTarget: 'revision-1' });
      wrapper.setState({ confirmationModal: true, disableOp: false, selectedRevision: 'revision-1' });
      wrapper.update();

      expect(wrapper.find('Modal').exists()).toBeTruthy();
      expect(wrapper.find('Modal').prop('title')).toContain('Switch to revision-1');
    });

    it('renders confirmation modal for policy kind with create operation', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'policy', opTarget: 'create' });
      wrapper.setState({ confirmationModal: true, disableOp: false });
      wrapper.update();

      expect(wrapper.find('Modal').exists()).toBeTruthy();
      expect(wrapper.find('Modal').prop('title')).toContain('Create Traffic Policies');
    });

    it('renders confirmation modal for policy kind with delete operation', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'policy', opTarget: 'delete' });
      wrapper.setState({ confirmationModal: true, disableOp: false });
      wrapper.update();

      expect(wrapper.find('Modal').exists()).toBeTruthy();
      expect(wrapper.find('Modal').prop('title')).toContain('Delete Traffic Policies');
    });

    it('does not render modal when confirmationModal is false', () => {
      const wrapper = mountWrapper(defaultProps);
      wrapper.setState({ confirmationModal: false });
      wrapper.update();

      expect(wrapper.find('Modal').prop('isOpen')).toBe(false);
    });
  });

  describe('IstioConfigPreview rendering', () => {
    it('renders preview when loaded and has authorization policies', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'policy', opTarget: 'create' });
      wrapper.setState({
        loaded: true,
        authorizationPolicies: [
          {
            metadata: { name: 'test-ap', namespace: 'test-namespace' },
            spec: {}
          }
        ] as any
      });
      wrapper.update();

      expect(wrapper.find('IstioConfigPreview').exists()).toBeTruthy();
    });

    it('does not render preview when not loaded', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'policy', opTarget: 'create' });
      wrapper.setState({ loaded: false });
      wrapper.update();

      expect(wrapper.find('IstioConfigPreview').exists()).toBe(false);
    });

    it('does not render preview for delete operation', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'policy', opTarget: 'delete' });
      wrapper.setState({
        loaded: true,
        authorizationPolicies: [
          {
            metadata: { name: 'test-ap', namespace: 'test-namespace' },
            spec: {}
          }
        ] as any
      });
      wrapper.update();

      expect(wrapper.find('IstioConfigPreview').prop('isOpen')).toBe(false);
    });
  });

  describe('Component lifecycle', () => {
    it('calls fetchPermission on mount for injection kind', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'injection', opTarget: 'enable' });
      const instance = wrapper.instance() as NamespaceTrafficPolicies;
      const fetchPermissionSpy = jest.spyOn(instance, 'fetchPermission').mockImplementation(() => {});

      wrapper.setProps({ nsTarget: 'new-namespace' });

      expect(fetchPermissionSpy).toHaveBeenCalled();
    });

    it('generates traffic policies when opTarget changes to create', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'policy', opTarget: 'update' });
      const instance = wrapper.instance() as NamespaceTrafficPolicies;
      const generateTrafficPoliciesSpy = jest.spyOn(instance, 'generateTrafficPolicies').mockImplementation(() => {});

      wrapper.setProps({ opTarget: 'create' });

      expect(generateTrafficPoliciesSpy).toHaveBeenCalled();
    });

    it('loads existing policies when opTarget changes to update', () => {
      const nsInfoWithConfig: NamespaceInfo = {
        ...mockNamespaceInfo,
        istioConfig: {
          permissions: {},
          resources: {
            [getGVKTypeString(gvkType.AuthorizationPolicy)]: [
              {
                metadata: { name: 'existing-ap', namespace: 'test-namespace' },
                spec: {}
              }
            ] as any,
            [getGVKTypeString(gvkType.Sidecar)]: [
              {
                metadata: { name: 'existing-sidecar', namespace: 'test-namespace' },
                spec: {}
              }
            ] as any
          },
          validations: {}
        }
      };

      const wrapper = mountWrapper({ ...defaultProps, nsInfo: nsInfoWithConfig, opTarget: 'create' });
      wrapper.setProps({ opTarget: 'update' });

      const instance = wrapper.instance() as NamespaceTrafficPolicies;
      expect(instance.state.authorizationPolicies.length).toBeGreaterThan(0);
      expect(instance.state.sidecars.length).toBeGreaterThan(0);
    });
  });

  describe('fetchPermission', () => {
    it('sets disableOp to false when permissions are granted', async () => {
      (API.getIstioPermissions as jest.Mock).mockResolvedValue({
        data: {
          'test-namespace': {
            [getGVKTypeString(gvkType.AuthorizationPolicy)]: {
              create: true,
              update: true,
              delete: true
            }
          }
        }
      });

      const wrapper = mountWrapper(defaultProps);
      const instance = wrapper.instance() as NamespaceTrafficPolicies;

      instance.fetchPermission();
      await new Promise(resolve => setTimeout(resolve, 0));
      wrapper.update();

      expect(instance.state.disableOp).toBe(false);
    });

    it('sets disableOp to true when permissions are not granted', async () => {
      (API.getIstioPermissions as jest.Mock).mockResolvedValue({
        data: {
          'test-namespace': {
            [getGVKTypeString(gvkType.AuthorizationPolicy)]: {
              create: false,
              update: false,
              delete: false
            }
          }
        }
      });

      const wrapper = mountWrapper(defaultProps);
      const instance = wrapper.instance() as NamespaceTrafficPolicies;

      instance.fetchPermission();
      await new Promise(resolve => setTimeout(resolve, 0));
      wrapper.update();

      expect(instance.state.disableOp).toBe(true);
    });
  });

  describe('onConfirm', () => {
    it('calls onAddRemoveAutoInjection for injection kind', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'injection', opTarget: 'enable' });
      const instance = wrapper.instance() as NamespaceTrafficPolicies;
      const onAddRemoveAutoInjectionSpy = jest.spyOn(instance, 'onAddRemoveAutoInjection').mockImplementation(() => {});

      wrapper.setState({ confirmationModal: true, disableOp: false });

      const confirmButton = wrapper.find('Button[data-test="confirm-create"]');
      confirmButton.simulate('click');

      expect(onAddRemoveAutoInjectionSpy).toHaveBeenCalledWith(false);
    });

    it('calls onAddRemoveAutoInjection for ambient kind', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'ambient', opTarget: 'enable' });
      const instance = wrapper.instance() as NamespaceTrafficPolicies;
      const onAddRemoveAutoInjectionSpy = jest.spyOn(instance, 'onAddRemoveAutoInjection').mockImplementation(() => {});

      wrapper.setState({ confirmationModal: true, disableOp: false });

      const confirmButton = wrapper.find('Button[data-test="confirm-create"]');
      confirmButton.simulate('click');

      expect(onAddRemoveAutoInjectionSpy).toHaveBeenCalledWith(true);
    });

    it('calls onUpgradeDowngradeIstio for canary kind', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'canary', opTarget: 'revision-1' });
      const instance = wrapper.instance() as NamespaceTrafficPolicies;
      const onUpgradeDowngradeIstioSpy = jest.spyOn(instance, 'onUpgradeDowngradeIstio').mockImplementation(() => {});

      wrapper.setState({ confirmationModal: true, disableOp: false, selectedRevision: 'revision-1' });

      const confirmButton = wrapper.find('Button[data-test="confirm-create"]');
      confirmButton.simulate('click');

      expect(onUpgradeDowngradeIstioSpy).toHaveBeenCalled();
    });

    it('calls onAddRemoveTrafficPolicies for policy kind', () => {
      const wrapper = mountWrapper({ ...defaultProps, kind: 'policy', opTarget: 'create' });
      const instance = wrapper.instance() as NamespaceTrafficPolicies;
      const onAddRemoveTrafficPoliciesSpy = jest
        .spyOn(instance, 'onAddRemoveTrafficPolicies')
        .mockImplementation(() => {});

      wrapper.setState({ confirmationModal: true, disableOp: false });

      const confirmButton = wrapper.find('Button[data-test="confirm-create"]');
      confirmButton.simulate('click');

      expect(onAddRemoveTrafficPoliciesSpy).toHaveBeenCalled();
    });
  });

  describe('onHideConfirmModal', () => {
    it('resets state and calls hideConfirmModal prop', () => {
      const hideConfirmModalSpy = jest.fn();
      const wrapper = mountWrapper({ ...defaultProps, hideConfirmModal: hideConfirmModalSpy });
      const instance = wrapper.instance() as NamespaceTrafficPolicies;

      wrapper.setState({
        confirmationModal: true,
        authorizationPolicies: [{ metadata: { name: 'test' }, spec: {} }] as any,
        sidecars: [{ metadata: { name: 'test' }, spec: {} }] as any
      });

      instance.onHideConfirmModal();

      expect(instance.state.confirmationModal).toBe(false);
      expect(instance.state.authorizationPolicies).toEqual([]);
      expect(instance.state.sidecars).toEqual([]);
      expect(hideConfirmModalSpy).toHaveBeenCalled();
    });
  });

  describe('getItemsPreview', () => {
    it('returns empty array when no policies exist', () => {
      const wrapper = shallow(<NamespaceTrafficPolicies {...defaultProps} />);
      const instance = wrapper.instance() as NamespaceTrafficPolicies;

      const items = instance.getItemsPreview();

      expect(items).toEqual([]);
    });

    it('returns items with authorization policies', () => {
      const wrapper = shallow(<NamespaceTrafficPolicies {...defaultProps} />);
      const instance = wrapper.instance() as NamespaceTrafficPolicies;

      wrapper.setState({
        authorizationPolicies: [
          {
            metadata: { name: 'test-ap', namespace: 'test-namespace' },
            spec: {}
          }
        ] as any
      });

      const items = instance.getItemsPreview();

      expect(items.length).toBe(1);
      expect(items[0].title).toBe('Authorization Policies');
    });

    it('returns items with sidecars', () => {
      const wrapper = shallow(<NamespaceTrafficPolicies {...defaultProps} />);
      const instance = wrapper.instance() as NamespaceTrafficPolicies;

      wrapper.setState({
        sidecars: [
          {
            metadata: { name: 'test-sidecar', namespace: 'test-namespace' },
            spec: {}
          }
        ] as any
      });

      const items = instance.getItemsPreview();

      expect(items.length).toBe(1);
      expect(items[0].title).toBe('Sidecars');
    });
  });
});
