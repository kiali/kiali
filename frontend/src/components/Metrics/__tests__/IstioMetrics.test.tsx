import * as React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { IstioMetrics } from '../IstioMetrics';
import * as API from '../../../services/Api';
import { store } from '../../../store/ConfigStore';
import { MetricsObjectTypes } from '../../../types/Metrics';
import { MounterMocker } from 'services/__mocks__/MounterMocker';
import { ChartModel, DashboardModel } from 'types/Dashboards';
import { KialiDisabledFeatures } from 'types/ServerConfig';

const createMetricChart = (name: string): ChartModel => {
  return {
    name: name,
    unit: 'B',
    spans: 12,
    metrics: [
      {
        labels: {},
        name: name,
        datapoints: [
          [1111, 5],
          [2222, 10]
        ]
      }
    ],
    startCollapsed: false
  };
};

const createHistogramChart = (name: string): ChartModel => {
  return {
    name: name,
    unit: 'B',
    spans: 12,
    metrics: [
      {
        labels: {},
        name: name,
        stat: 'avg',
        datapoints: [
          [1111, 10],
          [2222, 11]
        ]
      },
      {
        labels: {},
        name: name,
        stat: '0.5',
        datapoints: [
          [1111, 20],
          [2222, 21]
        ]
      },
      {
        labels: {},
        name: name,
        stat: '0.95',
        datapoints: [
          [1111, 30],
          [2222, 31]
        ]
      },
      {
        labels: {},
        name: name,
        stat: '0.99',
        datapoints: [
          [1111, 40],
          [2222, 41]
        ]
      }
    ],
    startCollapsed: false
  };
};

describe('Metrics for a service', () => {
  beforeEach(() => {
    jest.spyOn(API, 'getGrafanaInfo').mockResolvedValue({ externalLinks: [] });
    jest.spyOn(API, 'getPersesInfo').mockResolvedValue({ url: '', dashboards: {} });
    jest.spyOn(API, 'getServiceDashboard').mockResolvedValue({
      data: { title: '', aggregations: [], charts: [], externalLinks: [], rows: 0 }
    } as any);
    jest.spyOn(API, 'getDisabledFeatures').mockResolvedValue({
      requestSize: false,
      requestSizeAverage: false,
      requestSizePercentiles: false,
      responseSize: false,
      responseSizeAverage: false,
      responseSizePercentiles: false,
      responseTime: false,
      responseTimeAverage: false,
      responseTimePercentiles: false
    } as KialiDisabledFeatures);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders initial layout', () => {
    const { container } = render(
      <Provider store={store}>
        <MemoryRouter>
          <IstioMetrics
            lastRefreshAt={1720526431902}
            namespace="ns"
            object="svc"
            objectType={MetricsObjectTypes.SERVICE}
            direction={'inbound'}
            includeAmbient={false}
          />
        </MemoryRouter>
      </Provider>
    );
    expect(container).toMatchSnapshot();
  });

  it('mounts and loads empty metrics', done => {
    const dashboard: DashboardModel = { title: 'foo', aggregations: [], charts: [], externalLinks: [], rows: 2 };
    new MounterMocker()
      .addMock('getServiceDashboard', dashboard)
      .mountWithStore(
        <IstioMetrics
          namespace="ns"
          object="svc"
          objectType={MetricsObjectTypes.SERVICE}
          direction={'inbound'}
          includeAmbient={false}
          lastRefreshAt={1720526431902}
        />
      )
      .run(done, container => {
        expect(container.querySelectorAll('[data-test="metrics-chart"]')).toHaveLength(0);
      });
  }, 10000);

  it('mounts and loads full metrics', done => {
    const dashboard: DashboardModel = {
      title: 'foo',
      aggregations: [],
      charts: [
        createMetricChart('m1'),
        createHistogramChart('m3'),
        createHistogramChart('m5'),
        createHistogramChart('m7')
      ],
      externalLinks: [],
      rows: 2
    };
    new MounterMocker()
      .addMock('getServiceDashboard', dashboard)
      .mountWithStore(
        <IstioMetrics
          namespace="ns"
          object="svc"
          objectType={MetricsObjectTypes.SERVICE}
          direction={'inbound'}
          includeAmbient={false}
          lastRefreshAt={1720526431902}
        />
      )
      .run(done, container => {
        expect(container.querySelectorAll('[data-test="metrics-chart"]')).toHaveLength(4);
      });
  }, 10000);
});

describe('Inbound Metrics for a workload', () => {
  beforeEach(() => {
    jest.spyOn(API, 'getGrafanaInfo').mockResolvedValue({ externalLinks: [] });
    jest.spyOn(API, 'getPersesInfo').mockResolvedValue({ url: '', dashboards: {} });
    jest.spyOn(API, 'getWorkloadDashboard').mockResolvedValue({
      data: { title: '', aggregations: [], charts: [], externalLinks: [], rows: 0 }
    } as any);
    jest.spyOn(API, 'getDisabledFeatures').mockResolvedValue({
      requestSize: false,
      requestSizeAverage: false,
      requestSizePercentiles: false,
      responseSize: false,
      responseSizeAverage: false,
      responseSizePercentiles: false,
      responseTime: false,
      responseTimeAverage: false,
      responseTimePercentiles: false
    } as KialiDisabledFeatures);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders initial layout', () => {
    const { container } = render(
      <Provider store={store}>
        <MemoryRouter>
          <IstioMetrics
            lastRefreshAt={1720526431902}
            namespace="ns"
            object="svc"
            objectType={MetricsObjectTypes.WORKLOAD}
            direction={'inbound'}
            includeAmbient={false}
          />
        </MemoryRouter>
      </Provider>
    );
    expect(container).toMatchSnapshot();
  });

  it('mounts and loads empty metrics', done => {
    const dashboard: DashboardModel = { title: 'foo', aggregations: [], charts: [], externalLinks: [], rows: 2 };
    new MounterMocker()
      .addMock('getWorkloadDashboard', dashboard)
      .mountWithStore(
        <IstioMetrics
          namespace="ns"
          object="wkd"
          objectType={MetricsObjectTypes.WORKLOAD}
          direction={'inbound'}
          includeAmbient={false}
          lastRefreshAt={1720526431902}
        />
      )
      .run(done, container => {
        expect(container.querySelectorAll('[data-test="metrics-chart"]')).toHaveLength(0);
      });
  }, 10000);

  it('mounts and loads full metrics', done => {
    const dashboard: DashboardModel = {
      title: 'foo',
      aggregations: [],
      charts: [
        createMetricChart('m1'),
        createHistogramChart('m3'),
        createHistogramChart('m5'),
        createHistogramChart('m7')
      ],
      externalLinks: [],
      rows: 2
    };
    new MounterMocker()
      .addMock('getWorkloadDashboard', dashboard)
      .mountWithStore(
        <IstioMetrics
          namespace="ns"
          object="wkd"
          objectType={MetricsObjectTypes.WORKLOAD}
          direction={'inbound'}
          includeAmbient={false}
          lastRefreshAt={1720526431902}
        />
      )
      .run(done, container => {
        expect(container.querySelectorAll('[data-test="metrics-chart"]')).toHaveLength(4);
      });
  }, 10000);
});
