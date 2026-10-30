import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from '@rstest/core';
import type { ExternalLink } from 'types/Dashboards';
import { ISTIO_MESH_DASHBOARD, ISTIO_PERFORMANCE_DASHBOARD } from 'types/GrafanaInfo';
import { ISTIO_ZTUNNEL_DASHBOARD } from 'types/Dashboards';
import { IstioDashboardsDropdown, IstioDashboardsDropdownLoader } from '../IstioDashboardsDropdown';
import { loadIstioDashboardLinks } from 'utils/IstioDashboardUtils';

rstest.mock('utils/I18nUtils', () => {
  const translate = (key: string, opts?: Record<string, unknown>): string => {
    if (!opts) {
      return key;
    }
    return Object.entries(opts).reduce((s, [k, v]) => s.replace(`{{${k}}}`, String(v)), key);
  };

  return {
    t: translate,
    useKialiTranslation: () => ({ t: translate })
  };
});

rstest.mock('utils/IstioDashboardUtils', () => {
  const actual = (rstest as any).requireActual('utils/IstioDashboardUtils');
  return {
    ...actual,
    loadIstioDashboardLinks: rstest.fn()
  };
});

const grafanaMesh: ExternalLink = {
  name: ISTIO_MESH_DASHBOARD,
  url: 'https://grafana.example/d/mesh',
  variables: {}
};
const grafanaPerf: ExternalLink = {
  name: ISTIO_PERFORMANCE_DASHBOARD,
  url: 'https://grafana.example/d/perf',
  variables: {}
};
const persesMesh: ExternalLink = {
  name: ISTIO_MESH_DASHBOARD,
  url: 'https://perses.example/d/mesh',
  variables: {}
};
const ztunnel: ExternalLink = {
  name: ISTIO_ZTUNNEL_DASHBOARD,
  url: 'https://grafana.example/d/ztunnel',
  variables: {}
};

describe('IstioDashboardsDropdown', () => {
  it('renders nothing when there are no dashboard links', () => {
    const { container } = render(<IstioDashboardsDropdown grafanaLinks={[]} persesLinks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists Grafana and Perses dashboards with tool-specific titles', async () => {
    const user = userEvent.setup();
    render(<IstioDashboardsDropdown grafanaLinks={[grafanaMesh, grafanaPerf]} persesLinks={[persesMesh]} />);

    await user.click(screen.getByTestId('istio-dashboards-toggle'));

    const grafanaMeshItem = screen.getByTestId('istio-dashboard-link-grafana-0');
    const persesMeshItem = screen.getByTestId('istio-dashboard-link-perses-0');
    const grafanaMeshLink = grafanaMeshItem.closest('a') ?? grafanaMeshItem.querySelector('a');
    const persesMeshLink = persesMeshItem.closest('a') ?? persesMeshItem.querySelector('a');

    expect(grafanaMeshLink).toHaveAttribute('href', grafanaMesh.url);
    expect(grafanaMeshItem).toHaveAttribute('title', `View ${ISTIO_MESH_DASHBOARD} in Grafana`);
    expect(persesMeshLink).toHaveAttribute('href', persesMesh.url);
    expect(persesMeshItem).toHaveAttribute('title', `View ${ISTIO_MESH_DASHBOARD} in Perses`);
    expect(screen.getByText('Grafana')).toBeInTheDocument();
    expect(screen.getByText('Perses')).toBeInTheDocument();
  });
});

describe('IstioDashboardsDropdownLoader', () => {
  const loadMock = loadIstioDashboardLinks as Mock;

  beforeEach(() => {
    loadMock.mockReset();
  });

  it('renders the dropdown after dashboard links load', async () => {
    loadMock.mockResolvedValue({ grafanaLinks: [ztunnel], persesLinks: [] });

    render(<IstioDashboardsDropdownLoader kind="ztunnel" />);

    expect(await screen.findByTestId('istio-dashboards-toggle')).toBeInTheDocument();
    expect(loadMock).toHaveBeenCalledWith('ztunnel');
  });

  it('renders nothing when loading returns no links', async () => {
    loadMock.mockResolvedValue({ grafanaLinks: [], persesLinks: [] });

    const { container } = render(<IstioDashboardsDropdownLoader kind="control-plane" />);

    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });
});
