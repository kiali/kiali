import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { NamespaceHealthStatus } from '../NamespaceHealthStatus';
import { NamespaceStatus } from '../../../types/NamespaceInfo';
import { setServerConfig } from '../../../config/ServerConfig';
import { healthConfig } from '../../../types/__testData__/HealthConfig';
import { naTextStyle } from 'styles/HealthStyle';
import { namespaceNaIconStyle } from '../NamespaceStyle';

describe('NamespaceHealthStatus', () => {
  beforeAll(() => {
    setServerConfig(healthConfig);
  });

  const store = createStore((state = {}) => state, {
    globalState: { kiosk: '' },
    userSettings: { duration: 600, refreshInterval: 10000 }
  } as any);

  const defaultProps = {
    name: 'test-namespace',
    worstStatus: 'NA'
  };

  const renderStatus = (props: React.ComponentProps<typeof NamespaceHealthStatus>): ReturnType<typeof render> =>
    render(
      <Provider store={store}>
        <NamespaceHealthStatus {...props} />
      </Provider>
    );

  it('renders Healthy when all statuses are healthy', () => {
    const statusApp: NamespaceStatus = {
      inError: [],
      inWarning: [],
      inNotReady: [],
      inSuccess: ['app1'],
      notAvailable: []
    };

    renderStatus({ ...defaultProps, statusApp, worstStatus: 'Healthy' });

    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.queryByTestId('namespace-health-details-trigger')).not.toBeInTheDocument();
  });

  it('renders Failure when there are errors', () => {
    const statusApp: NamespaceStatus = {
      inError: ['app1'],
      inWarning: [],
      inNotReady: [],
      inSuccess: [],
      notAvailable: []
    };

    renderStatus({ ...defaultProps, statusApp, worstStatus: 'Failure' });

    expect(screen.getByText('Failure')).toBeInTheDocument();
    expect(screen.getByText('1 issue')).toBeInTheDocument();
    expect(screen.getByTestId('namespace-health-details-trigger')).toBeInTheDocument();
  });

  it('renders Degraded when there are warnings', () => {
    const statusApp: NamespaceStatus = {
      inError: [],
      inWarning: ['app1'],
      inNotReady: [],
      inSuccess: [],
      notAvailable: []
    };

    renderStatus({ ...defaultProps, statusApp, worstStatus: 'Degraded' });

    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(screen.getByText('1 issue')).toBeInTheDocument();
  });

  it('renders n/a when worst status is NA', () => {
    const statusApp: NamespaceStatus = {
      inError: [],
      inWarning: [],
      inNotReady: [],
      inSuccess: [],
      notAvailable: ['app1']
    };

    const { container } = renderStatus({ ...defaultProps, statusApp, worstStatus: 'NA' });

    expect(container.textContent).toContain('n/a');
    expect(container.textContent).not.toContain('Failure');
    expect(container.textContent).not.toContain('Degraded');
    expect(container.textContent).not.toContain('Not Ready');
    expect(container.textContent).not.toContain('Healthy');
    expect(container.textContent).not.toContain('issue');
  });

  it('renders n/a when only notAvailable items exist across all status types', () => {
    const statusApp: NamespaceStatus = {
      inError: [],
      inWarning: [],
      inNotReady: [],
      inSuccess: [],
      notAvailable: ['app1']
    };

    const statusService: NamespaceStatus = {
      inError: [],
      inWarning: [],
      inNotReady: [],
      inSuccess: [],
      notAvailable: ['svc1']
    };

    const statusWorkload: NamespaceStatus = {
      inError: [],
      inWarning: [],
      inNotReady: [],
      inSuccess: [],
      notAvailable: ['wl1']
    };

    const { container } = renderStatus({
      ...defaultProps,
      statusApp,
      statusService,
      statusWorkload,
      worstStatus: 'NA'
    });

    expect(container.textContent).toContain('n/a');
    expect(container.textContent).not.toContain('Failure');
    expect(container.textContent).not.toContain('Degraded');
    expect(container.textContent).not.toContain('Not Ready');
    expect(container.textContent).not.toContain('Healthy');
    expect(container.textContent).not.toContain('issue');
  });

  it('renders Failure when there are errors even if notAvailable items exist', () => {
    const statusApp: NamespaceStatus = {
      inError: ['app1'],
      inWarning: [],
      inNotReady: [],
      inSuccess: [],
      notAvailable: ['app2']
    };

    const { container } = renderStatus({ ...defaultProps, statusApp, worstStatus: 'Failure' });

    expect(screen.getByText('Failure')).toBeInTheDocument();
    expect(container.textContent).not.toContain('n/a');
    expect(screen.getByText('1 issue')).toBeInTheDocument();
  });

  it('renders n/a when no status data is provided (and uses subtle/disabled colors)', () => {
    renderStatus({ ...defaultProps });

    const naText = screen.getByText('n/a');
    expect(naText.closest(`div.${naTextStyle}`)).toBeTruthy();

    const naIcon = document.querySelector('span.icon-na');
    expect(naIcon).toBeTruthy();
    expect(naIcon!.closest(`.${namespaceNaIconStyle}`)).toBeTruthy();
  });

  it('prioritizes FAILURE over other statuses', () => {
    const statusApp: NamespaceStatus = {
      inError: ['app1'],
      inWarning: ['app2'],
      inNotReady: ['app3'],
      inSuccess: ['app4'],
      notAvailable: ['app5']
    };

    renderStatus({ ...defaultProps, statusApp, worstStatus: 'Failure' });

    expect(screen.getByText('Failure')).toBeInTheDocument();
    expect(screen.getByText('3 issues')).toBeInTheDocument();
  });

  it('prioritizes DEGRADED over HEALTHY and NA', () => {
    const statusApp: NamespaceStatus = {
      inError: [],
      inWarning: ['app1'],
      inNotReady: [],
      inSuccess: ['app2'],
      notAvailable: ['app3']
    };

    renderStatus({ ...defaultProps, statusApp, worstStatus: 'Degraded' });

    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(screen.getByText('1 issue')).toBeInTheDocument();
  });
});
