import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { serverConfig } from 'config';
import { IstioActionsNamespaceDropdown } from '../IstioActionsNamespaceDropdown';

const mockNavigate = rstest.fn();

rstest.mock('hooks/redux', () => ({
  useKialiSelector: (selector: any) => selector({ globalState: { kiosk: '' } })
}));

rstest.mock('react-router-dom-v5-compat', () => {
  const actual = (rstest as any).requireActual('react-router-dom-v5-compat');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

rstest.mock('utils/I18nUtils', () => ({
  t: (key: string) => key,
  useKialiTranslation: () => ({
    t: (key: string) => key
  })
}));

describe('IstioActionsNamespaceDropdown', () => {
  const origViewOnly = serverConfig.deployment.viewOnlyMode;

  afterEach(() => {
    serverConfig.deployment.viewOnlyMode = origViewOnly;
    mockNavigate.mockReset();
  });

  it('disables create actions when viewOnlyMode is true', async () => {
    const user = userEvent.setup();
    serverConfig.deployment.viewOnlyMode = true;

    render(<IstioActionsNamespaceDropdown />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));

    const authorizationPolicy = screen.getByRole('menuitem', { name: 'AuthorizationPolicy' });
    expect(authorizationPolicy).toBeDisabled();

    await user.hover(authorizationPolicy.closest('div')!);
    expect(await screen.findByText('No user permission or Kiali in view-only mode')).toBeInTheDocument();
  });

  it('keeps create actions enabled when viewOnlyMode is false', async () => {
    const user = userEvent.setup();
    serverConfig.deployment.viewOnlyMode = false;

    render(<IstioActionsNamespaceDropdown />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'AuthorizationPolicy' }));

    expect(mockNavigate).toHaveBeenCalledWith('/istio/new/security.istio.io/v1/AuthorizationPolicy');
  });
});
