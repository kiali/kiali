import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

jest.mock('components/IstioConfigPreview/IstioConfigPreview', () => ({
  IstioConfigPreview: (props: any) => (
    <div data-test="IstioConfigPreview" data-is-open={props.isOpen ? 'true' : 'false'} />
  ),
  ConfigPreviewItem: {}
}));

jest.mock('services/GraphDataSource', () => ({
  GraphDataSource: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    fetchForNamespace: jest.fn(),
    fetchForNamespaceParams: jest.fn().mockReturnValue({}),
    fetchGraphData: jest.fn()
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

describe('NamespaceTrafficPolicies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component initialization', () => {
    it('renders without crashing', () => {
      const { container } = render(<NamespaceTrafficPolicies {...defaultProps} />);
      expect(container).toBeTruthy();
    });

    it('initializes state correctly for create operation', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} opTarget="create" />);
      expect(ref.current!.state.loaded).toBe(false);
      expect(ref.current!.state.disableOp).toBe(true);
      expect(ref.current!.state.confirmationModal).toBe(false);
    });

    it('initializes state correctly for update operation', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} opTarget="update" />);
      expect(ref.current!.state.loaded).toBe(true);
      expect(ref.current!.state.disableOp).toBe(true);
    });

    it('initializes state correctly for canary kind', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="canary" opTarget="revision-1" />);
      expect(ref.current!.state.selectedRevision).toBe('revision-1');
    });
  });

  describe('Modal rendering', () => {
    it('renders confirmation modal for injection kind', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="injection" opTarget="enable" />);
      act(() => {
        ref.current!.setState({ confirmationModal: true, disableOp: false });
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('dialog').textContent).toContain('Enable Auto Injection');
    });

    it('renders confirmation modal for ambient kind', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="ambient" opTarget="enable" />);
      act(() => {
        ref.current!.setState({ confirmationModal: true, disableOp: false });
      });

      expect(screen.getByRole('dialog').textContent).toContain('Enable Ambient');
    });

    it('renders confirmation modal for canary kind', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="canary" opTarget="revision-1" />);
      act(() => {
        ref.current!.setState({ confirmationModal: true, disableOp: false, selectedRevision: 'revision-1' });
      });

      expect(screen.getByRole('dialog').textContent).toContain('Switch to revision-1');
    });

    it('renders confirmation modal for policy kind with create operation', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="policy" opTarget="create" />);
      act(() => {
        ref.current!.setState({ confirmationModal: true, disableOp: false });
      });

      expect(screen.getByRole('dialog').textContent).toContain('Create Traffic Policies');
    });

    it('renders confirmation modal for policy kind with delete operation', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="policy" opTarget="delete" />);
      act(() => {
        ref.current!.setState({ confirmationModal: true, disableOp: false });
      });

      expect(screen.getByRole('dialog').textContent).toContain('Delete Traffic Policies');
    });

    it('does not render modal when confirmationModal is false', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} />);
      act(() => {
        ref.current!.setState({ confirmationModal: false });
      });

      expect(screen.queryByTestId('confirm-create')).not.toBeInTheDocument();
    });
  });

  describe('IstioConfigPreview rendering', () => {
    it('renders preview when loaded and has authorization policies', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="policy" opTarget="create" />);
      act(() => {
        ref.current!.setState({
          loaded: true,
          authorizationPolicies: [
            {
              metadata: { name: 'test-ap', namespace: 'test-namespace' },
              spec: {}
            }
          ] as any
        });
      });

      expect(screen.getByTestId('IstioConfigPreview')).toBeInTheDocument();
    });

    it('does not render preview when not loaded', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="policy" opTarget="create" />);
      act(() => {
        ref.current!.setState({ loaded: false });
      });

      expect(screen.queryByTestId('IstioConfigPreview')).not.toBeInTheDocument();
    });

    it('does not render preview for delete operation', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="policy" opTarget="delete" />);
      act(() => {
        ref.current!.setState({
          loaded: true,
          authorizationPolicies: [
            {
              metadata: { name: 'test-ap', namespace: 'test-namespace' },
              spec: {}
            }
          ] as any
        });
      });

      expect(screen.getByTestId('IstioConfigPreview').getAttribute('data-is-open')).toBe('false');
    });
  });

  describe('Component lifecycle', () => {
    it('calls fetchPermission on mount for injection kind', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      const { rerender } = render(
        <NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="injection" opTarget="enable" />
      );
      const fetchPermissionSpy = jest.spyOn(ref.current!, 'fetchPermission').mockImplementation(() => {});

      rerender(
        <NamespaceTrafficPolicies
          ref={ref}
          {...defaultProps}
          kind="injection"
          opTarget="enable"
          nsTarget="new-namespace"
        />
      );

      expect(fetchPermissionSpy).toHaveBeenCalled();
    });

    it('generates traffic policies when opTarget changes to create', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      const { rerender } = render(
        <NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="policy" opTarget="update" />
      );
      const generateTrafficPoliciesSpy = jest
        .spyOn(ref.current!, 'generateTrafficPolicies')
        .mockImplementation(() => {});

      rerender(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="policy" opTarget="create" />);

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

      const ref = React.createRef<NamespaceTrafficPolicies>();
      const { rerender } = render(
        <NamespaceTrafficPolicies ref={ref} {...defaultProps} nsInfo={nsInfoWithConfig} opTarget="create" />
      );
      rerender(<NamespaceTrafficPolicies ref={ref} {...defaultProps} nsInfo={nsInfoWithConfig} opTarget="update" />);

      expect(ref.current!.state.authorizationPolicies.length).toBeGreaterThan(0);
      expect(ref.current!.state.sidecars.length).toBeGreaterThan(0);
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

      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} />);

      await act(async () => {
        ref.current!.fetchPermission();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(ref.current!.state.disableOp).toBe(false);
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

      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} />);

      await act(async () => {
        ref.current!.fetchPermission();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(ref.current!.state.disableOp).toBe(true);
    });
  });

  describe('onConfirm', () => {
    const clickLastConfirm = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
      const buttons = screen.getAllByTestId('confirm-create');
      await user.click(buttons[buttons.length - 1]);
    };

    it('calls onAddRemoveAutoInjection for injection kind', async () => {
      const user = userEvent.setup();
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="injection" opTarget="enable" />);
      const onAddRemoveAutoInjectionSpy = jest
        .spyOn(ref.current!, 'onAddRemoveAutoInjection')
        .mockImplementation(() => {});

      act(() => {
        ref.current!.setState({ confirmationModal: true, disableOp: false });
      });

      await clickLastConfirm(user);

      expect(onAddRemoveAutoInjectionSpy).toHaveBeenCalledWith(false);
    });

    it('calls onAddRemoveAutoInjection for ambient kind', async () => {
      const user = userEvent.setup();
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="ambient" opTarget="enable" />);
      const onAddRemoveAutoInjectionSpy = jest
        .spyOn(ref.current!, 'onAddRemoveAutoInjection')
        .mockImplementation(() => {});

      act(() => {
        ref.current!.setState({ confirmationModal: true, disableOp: false });
      });

      await clickLastConfirm(user);

      expect(onAddRemoveAutoInjectionSpy).toHaveBeenCalledWith(true);
    });

    it('calls onUpgradeDowngradeIstio for canary kind', async () => {
      const user = userEvent.setup();
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="canary" opTarget="revision-1" />);
      const onUpgradeDowngradeIstioSpy = jest
        .spyOn(ref.current!, 'onUpgradeDowngradeIstio')
        .mockImplementation(() => {});

      act(() => {
        ref.current!.setState({ confirmationModal: true, disableOp: false, selectedRevision: 'revision-1' });
      });

      await clickLastConfirm(user);

      expect(onUpgradeDowngradeIstioSpy).toHaveBeenCalled();
    });

    it('calls onAddRemoveTrafficPolicies for policy kind', async () => {
      const user = userEvent.setup();
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} kind="policy" opTarget="create" />);
      const onAddRemoveTrafficPoliciesSpy = jest
        .spyOn(ref.current!, 'onAddRemoveTrafficPolicies')
        .mockImplementation(() => {});

      act(() => {
        ref.current!.setState({ confirmationModal: true, disableOp: false });
      });

      await clickLastConfirm(user);

      expect(onAddRemoveTrafficPoliciesSpy).toHaveBeenCalled();
    });
  });

  describe('onHideConfirmModal', () => {
    it('resets state and calls hideConfirmModal prop', () => {
      const hideConfirmModalSpy = jest.fn();
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} hideConfirmModal={hideConfirmModalSpy} />);

      act(() => {
        ref.current!.setState({
          confirmationModal: true,
          authorizationPolicies: [{ metadata: { name: 'test' }, spec: {} }] as any,
          sidecars: [{ metadata: { name: 'test' }, spec: {} }] as any
        });
      });

      ref.current!.onHideConfirmModal();

      expect(ref.current!.state.confirmationModal).toBe(false);
      expect(ref.current!.state.authorizationPolicies).toEqual([]);
      expect(ref.current!.state.sidecars).toEqual([]);
      expect(hideConfirmModalSpy).toHaveBeenCalled();
    });
  });

  describe('getItemsPreview', () => {
    it('returns empty array when no policies exist', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} />);

      const items = ref.current!.getItemsPreview();

      expect(items).toEqual([]);
    });

    it('returns items with authorization policies', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} />);

      act(() => {
        ref.current!.setState({
          authorizationPolicies: [
            {
              metadata: { name: 'test-ap', namespace: 'test-namespace' },
              spec: {}
            }
          ] as any
        });
      });

      const items = ref.current!.getItemsPreview();

      expect(items.length).toBe(1);
      expect(items[0].title).toBe('Authorization Policies');
    });

    it('returns items with sidecars', () => {
      const ref = React.createRef<NamespaceTrafficPolicies>();
      render(<NamespaceTrafficPolicies ref={ref} {...defaultProps} />);

      act(() => {
        ref.current!.setState({
          sidecars: [
            {
              metadata: { name: 'test-sidecar', namespace: 'test-namespace' },
              spec: {}
            }
          ] as any
        });
      });

      const items = ref.current!.getItemsPreview();

      expect(items.length).toBe(1);
      expect(items[0].title).toBe('Sidecars');
    });
  });
});
