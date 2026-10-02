import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { CustomMetrics } from '../CustomMetrics';
import * as API from '../../../services/Api';
import { store } from '../../../store/ConfigStore';
import type { DashboardModel } from 'types/Dashboards';
import { MounterMocker } from 'services/__mocks__/MounterMocker';

const dashboard: DashboardModel = {
  title: 'Envoy Metrics',
  aggregations: [],
  charts: [
    {
      name: 'Pods uptime',
      unit: 's',
      spans: 12,
      metrics: [
        {
          labels: {},
          name: 'envoy_server_uptime',
          datapoints: [
            [1111, 100],
            [2222, 200]
          ]
        }
      ],
      startCollapsed: false
    }
  ],
  externalLinks: [],
  rows: 2
};

describe('CustomMetrics labelsFilters', () => {
  beforeEach(() => {
    rstest.spyOn(API, 'getCustomDashboard').mockResolvedValue({ data: dashboard } as any);
  });

  afterEach(() => {
    rstest.clearAllMocks();
  });

  it('requests envoy dashboard with version label filters', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <CustomMetrics
            app="details"
            appLabelName="app"
            embedded={true}
            lastRefreshAt={1720526431902}
            namespace="bookinfo"
            template="envoy"
            version="v1"
            versionLabelName="version"
            workload="details-v1"
          />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(API.getCustomDashboard).toHaveBeenCalled();
    });

    expect(API.getCustomDashboard).toHaveBeenCalledWith(
      'bookinfo',
      'envoy',
      expect.objectContaining({
        labelsFilters: 'app:details,version:v1',
        workload: 'details-v1'
      }),
      undefined
    );
  });

  it('renders envoy metric series when dashboard returns datapoints', () => {
    return new MounterMocker()
      .addMock('getCustomDashboard', dashboard)
      .mountWithStore(
        <CustomMetrics
          app="details"
          appLabelName="app"
          embedded={true}
          lastRefreshAt={1720526431902}
          namespace="bookinfo"
          template="envoy"
          version="v1"
          versionLabelName="version"
          workload="details-v1"
        />
      )
      .run(container => {
        const chart = container.querySelector('[data-test="metrics-chart"]');
        expect(chart).not.toBeNull();
        expect(chart!.querySelector('.pf-v6-c-chart path')).not.toBeNull();
      });
  });
});
