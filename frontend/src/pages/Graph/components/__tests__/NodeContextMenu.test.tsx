import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DropdownGroup, DropdownItem } from '@patternfly/react-core';
import { ContextMenu } from '@patternfly/react-topology';
import { ServiceWizardActionsDropdownGroup } from 'components/IstioWizards/ServiceWizardActionsDropdownGroup';
import { WIZARD_REQUEST_ROUTING } from 'components/IstioWizards/WizardActions';
import { serverConfig } from 'config';

describe('graph node context menu selection', () => {
  it('closes the menu when a navigation item is selected', async () => {
    const onNavigate = rstest.fn();

    render(
      <ContextMenu reference={{ x: 0, y: 0 }}>
        <DropdownGroup label="Show">
          <DropdownItem onClick={onNavigate}>Details</DropdownItem>
        </DropdownGroup>
      </ContextMenu>
    );

    fireEvent.click(await screen.findByRole('menuitem', { name: 'Details' }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Details' })).not.toBeInTheDocument());
  });

  it('closes the menu when a service wizard action is selected', async () => {
    const originalViewOnly = serverConfig.deployment.viewOnlyMode;
    const originalIstioAPIInstalled = serverConfig.istioAPIInstalled;
    serverConfig.deployment.viewOnlyMode = false;
    serverConfig.istioAPIInstalled = true;
    const onAction = rstest.fn();

    try {
      render(
        <ContextMenu reference={{ x: 0, y: 0 }}>
          <ServiceWizardActionsDropdownGroup
            destinationRules={[]}
            istioPermissions={{ create: true, update: true, delete: true }}
            k8sGRPCRoutes={[]}
            k8sHTTPRoutes={[]}
            onAction={onAction}
            virtualServices={[]}
          />
        </ContextMenu>
      );

      fireEvent.click(await screen.findByRole('menuitem', { name: 'Request Routing' }));

      expect(onAction).toHaveBeenCalledWith(WIZARD_REQUEST_ROUTING, 'create');
      await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Request Routing' })).not.toBeInTheDocument());
    } finally {
      serverConfig.deployment.viewOnlyMode = originalViewOnly;
      serverConfig.istioAPIInstalled = originalIstioAPIInstalled;
    }
  });
});
