import * as React from 'react';
import { shallow } from 'enzyme';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { shallowToJson } from 'enzyme-to-json';
import { IstioMetrics } from '../IstioMetrics';
import * as API from '../../../services/Api';
import { store } from '../../../store/ConfigStore';
import { MetricsObjectTypes } from '../../../types/Metrics';
import { MounterMocker } from 'services/__mocks__/MounterMocker';
import { ChartModel, DashboardModel } from 'types/Dashboards';
import { KialiCrippledFeatures } from 'types/ServerConfig';

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
    jest.spyOn(API, 'getCrippledFeatures').mockResolvedValue({
      requestSize: false,
      requestSizeAverage: false,
      requestSizePercentiles: false,
      responseSize: false,
      responseSizeAverage: false,
      responseSizePercentiles: false,
      responseTime: false,
      responseTimeAverage: false,
      responseTimePercentiles: false
    } as KialiCrippledFeatures);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders initial layout', () => {
    const wrapper = shallow(
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
    expect(shallowToJson(wrapper)).toMatchSnapshot();
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
      .run(done, wrapper => {
        expect(wrapper.find('Chart')).toHaveLength(0);
      });
  });

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
      .run(done, wrapper => {
        expect(wrapper.find('Chart')).toHaveLength(4);
      });
  }, 10000); // Increase timeout for this test
});

describe('Inbound Metrics for a workload', () => {
  beforeEach(() => {
    jest.spyOn(API, 'getCrippledFeatures').mockResolvedValue({
      requestSize: false,
      requestSizeAverage: false,
      requestSizePercentiles: false,
      responseSize: false,
      responseSizeAverage: false,
      responseSizePercentiles: false,
      responseTime: false,
      responseTimeAverage: false,
      responseTimePercentiles: false
    } as KialiCrippledFeatures);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders initial layout', () => {
    const wrapper = shallow(
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
    expect(shallowToJson(wrapper)).toMatchSnapshot();
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
      .run(done, wrapper => {
        expect(wrapper.find('Chart')).toHaveLength(0);
      });
  });

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
      .run(done, wrapper => {
        expect(wrapper.find('Chart')).toHaveLength(4);
      });
  }, 10000); // Increase timeout for this test
});
