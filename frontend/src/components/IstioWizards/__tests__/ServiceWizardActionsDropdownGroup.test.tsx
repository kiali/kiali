import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { serverConfig } from 'config';
import { ServiceWizardActionsDropdownGroup } from '../ServiceWizardActionsDropdownGroup';
import { KIALI_WIZARD_LABEL, WIZARD_REQUEST_ROUTING } from '../WizardActions';

jest.mock('utils/I18nUtils', () => ({
  t: (key: string) => key
}));

describe('ServiceWizardActionsDropdownGroup', () => {
  const origViewOnly = serverConfig.deployment.viewOnlyMode;
  const origIstioAPIInstalled = serverConfig.istioAPIInstalled;

  const baseProps = {
    destinationRules: [],
    istioPermissions: {
      create: true,
      update: true,
      delete: true
    },
    k8sGRPCRoutes: [],
    k8sHTTPRoutes: [],
    onAction: jest.fn(),
    onDelete: jest.fn(),
    virtualServices: []
  };

  afterEach(() => {
    serverConfig.deployment.viewOnlyMode = origViewOnly;
    serverConfig.istioAPIInstalled = origIstioAPIInstalled;
    baseProps.onAction.mockReset();
    baseProps.onDelete.mockReset();
  });

  it('shows View and disables all actions in view-only mode when there is no traffic policy', () => {
    serverConfig.deployment.viewOnlyMode = true;
    serverConfig.istioAPIInstalled = true;

    render(<ServiceWizardActionsDropdownGroup {...baseProps} />);

    const requestRoutingButton = screen.getByText('Request Routing').closest('button');
    const faultInjectionButton = screen.getByText('Fault Injection').closest('button');
    const deleteButton = screen.getByText('Delete Traffic Routing').closest('button');

    expect(screen.getByText('View')).toBeInTheDocument();
    expect(requestRoutingButton).toBeDisabled();
    expect(faultInjectionButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
  });

  it('shows View and only enables the existing traffic policy in view-only mode', () => {
    serverConfig.deployment.viewOnlyMode = true;
    serverConfig.istioAPIInstalled = true;

    render(
      <ServiceWizardActionsDropdownGroup
        {...baseProps}
        virtualServices={[
          {
            metadata: {
              labels: {
                [KIALI_WIZARD_LABEL]: WIZARD_REQUEST_ROUTING
              },
              name: 'ratings',
              namespace: 'bookinfo'
            },
            spec: {}
          } as any
        ]}
      />
    );

    const requestRoutingButton = screen.getByText('Request Routing').closest('button');
    const faultInjectionButton = screen.getByText('Fault Injection').closest('button');

    expect(screen.getByText('View')).toBeInTheDocument();
    expect(requestRoutingButton).toBeEnabled();
    expect(faultInjectionButton).toBeDisabled();

    fireEvent.click(requestRoutingButton!);
    expect(baseProps.onAction).toHaveBeenCalledWith(WIZARD_REQUEST_ROUTING, 'update');
  });
});
