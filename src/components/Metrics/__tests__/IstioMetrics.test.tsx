import * as React from 'react';
import { mount, shallow, ReactWrapper } from 'enzyme';
import { Provider } from 'react-redux';
import { MemoryRouter, Route } from 'react-router';
import { DashboardModel, ChartModel } from 'k-charted-react';
import { shallowToJson } from 'enzyme-to-json';

import IstioMetrics from '../IstioMetrics';
import * as API from '../../../services/Api';
import { store } from '../../../store/ConfigStore';
import { MetricsObjectTypes } from '../../../types/Metrics';

(window as any).SVGPathElement = a => a;
let mounted: ReactWrapper<any, any> | null;

const mockAPIToPromise = (func: keyof typeof API, obj: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    jest.spyOn(API, func).mockImplementation(() => {
      return new Promise(r => {
        r({ data: obj });
        setTimeout(() => {
          try {
            resolve();
          } catch (e) {
            reject(e);
          }
        }, 1);
      });
    });
  });
};

const mockServiceDashboard = (dashboard: DashboardModel): Promise<void> => {
  return mockAPIToPromise('getServiceDashboard', dashboard);
};

const mockWorkloadDashboard = (dashboard: DashboardModel): Promise<void> => {
  return mockAPIToPromise('getWorkloadDashboard', dashboard);
};

const mockGrafanaInfo = (info: any): Promise<any> => {
  return mockAPIToPromise('getGrafanaInfo', info);
};

const createMetricChart = (name: string): ChartModel => {
  return {
    name: name,
    unit: 'B',
    spans: 12,
    metric: [
      {
        labelSet: { __name__: name },
        values: [[1111, 5], [2222, 10]],
        name: ''
      }
    ]
  };
};

const createHistogramChart = (name: string): ChartModel => {
  return {
    name: name,
    unit: 'B',
    spans: 12,
    histogram: {
      average: [
        {
          labelSet: { __name__: name },
          values: [[1111, 10], [2222, 11]],
          name: name
        }
      ],
      median: [
        {
          labelSet: { __name__: name },
          values: [[1111, 20], [2222, 21]],
          name: name
        }
      ],
      percentile95: [
        {
          labelSet: { __name__: name },
          values: [[1111, 30], [2222, 31]],
          name: name
        }
      ],
      percentile99: [
        {
          labelSet: { __name__: name },
          values: [[1111, 40], [2222, 41]],
          name: name
        }
      ]
    }
  };
};

describe('Metrics for a service', () => {
  beforeEach(() => {
    mounted = null;
  });
  afterEach(() => {
    if (mounted) {
      mounted.unmount();
    }
  });

  it('renders initial layout', () => {
    mockGrafanaInfo({});
    const wrapper = shallow(
      <Provider store={store}>
        <MemoryRouter>
          <Route
            render={props => (
              <IstioMetrics
                {...props}
                namespace="ns"
                object="svc"
                objectType={MetricsObjectTypes.SERVICE}
                direction={'inbound'}
                grafanaInfo={{
                  url: 'http://172.30.139.113:3000',
                  serviceDashboardPath: '/dashboard/db/istio-dashboard',
                  workloadDashboardPath: '/dashboard/db/istio-dashboard'
                }}
              />
            )}
          />
        </MemoryRouter>
      </Provider>
    );
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('mounts and loads empty metrics', done => {
    const allMocksDone = [
      mockServiceDashboard({ title: 'foo', aggregations: [], charts: [] })
        .then(() => {
          mounted!.update();
          expect(mounted!.find('.card-pf')).toHaveLength(1);
          mounted!.find('.card-pf').forEach(pfCard => expect(pfCard.children().length === 0));
        })
        .catch(err => done.fail(err))
    ];
    Promise.all(allMocksDone).then(() => done());
    mounted = mount(
      <Provider store={store}>
        <MemoryRouter>
          <Route
            render={props => (
              <IstioMetrics
                {...props}
                namespace="ns"
                object="svc"
                objectType={MetricsObjectTypes.SERVICE}
                direction={'inbound'}
                grafanaInfo={{
                  url: 'http://172.30.139.113:3000',
                  serviceDashboardPath: '/dashboard/db/istio-dashboard',
                  workloadDashboardPath: '/dashboard/db/istio-dashboard'
                }}
              />
            )}
          />
        </MemoryRouter>
      </Provider>
    );
  });

  it('mounts and loads full metrics', done => {
    const allMocksDone = [
      mockServiceDashboard({
        title: 'foo',
        aggregations: [],
        charts: [
          createMetricChart('m1'),
          createHistogramChart('m3'),
          createHistogramChart('m5'),
          createHistogramChart('m7')
        ]
      })
        .then(() => {
          mounted!.update();
          expect(mounted!.find('LineChart')).toHaveLength(4);
        })
        .catch(err => done.fail(err))
    ];
    Promise.all(allMocksDone).then(() => done());
    mounted = mount(
      <Provider store={store}>
        <MemoryRouter>
          <Route
            render={props => (
              <IstioMetrics
                {...props}
                namespace="ns"
                object="svc"
                objectType={MetricsObjectTypes.SERVICE}
                direction={'inbound'}
                grafanaInfo={{
                  url: 'http://172.30.139.113:3000',
                  serviceDashboardPath: '/dashboard/db/istio-dashboard',
                  workloadDashboardPath: '/dashboard/db/istio-dashboard'
                }}
              />
            )}
          />
        </MemoryRouter>
      </Provider>
    );
  }, 10000); // Increase timeout for this test
});

describe('Inbound Metrics for a workload', () => {
  beforeEach(() => {
    mounted = null;
  });
  afterEach(() => {
    if (mounted) {
      mounted.unmount();
    }
  });

  it('renders initial layout', () => {
    const wrapper = shallow(
      <Provider store={store}>
        <Route
          render={props => (
            <IstioMetrics
              {...props}
              namespace="ns"
              object="svc"
              objectType={MetricsObjectTypes.WORKLOAD}
              direction={'inbound'}
              grafanaInfo={{
                url: 'http://172.30.139.113:3000',
                serviceDashboardPath: '/dashboard/db/istio-dashboard',
                workloadDashboardPath: '/dashboard/db/istio-dashboard'
              }}
            />
          )}
        />
      </Provider>
    );
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('mounts and loads empty metrics', done => {
    const allMocksDone = [
      mockWorkloadDashboard({ title: 'foo', aggregations: [], charts: [] })
        .then(() => {
          mounted!.update();
          expect(mounted!.find('.card-pf')).toHaveLength(1);
          mounted!.find('.card-pf').forEach(pfCard => expect(pfCard.children().length === 0));
        })
        .catch(err => done.fail(err))
    ];
    Promise.all(allMocksDone).then(() => done());
    mounted = mount(
      <Provider store={store}>
        <MemoryRouter>
          <Route
            render={props => (
              <IstioMetrics
                {...props}
                namespace="ns"
                object="svc"
                objectType={MetricsObjectTypes.WORKLOAD}
                direction={'inbound'}
                grafanaInfo={{
                  url: 'http://172.30.139.113:3000',
                  serviceDashboardPath: '/dashboard/db/istio-dashboard',
                  workloadDashboardPath: '/dashboard/db/istio-dashboard'
                }}
              />
            )}
          />
        </MemoryRouter>
      </Provider>
    );
  });

  it('mounts and loads full metrics', done => {
    const allMocksDone = [
      mockWorkloadDashboard({
        title: 'foo',
        aggregations: [],
        charts: [
          createMetricChart('m1'),
          createHistogramChart('m3'),
          createHistogramChart('m5'),
          createHistogramChart('m7')
        ]
      })
        .then(() => {
          mounted!.update();
          expect(mounted!.find('LineChart')).toHaveLength(4);
        })
        .catch(err => done.fail(err))
    ];
    Promise.all(allMocksDone).then(() => done());
    mounted = mount(
      <Provider store={store}>
        <MemoryRouter>
          <Route
            render={props => (
              <IstioMetrics
                {...props}
                namespace="ns"
                object="svc"
                objectType={MetricsObjectTypes.WORKLOAD}
                direction={'inbound'}
                grafanaInfo={{
                  url: 'http://172.30.139.113:3000',
                  serviceDashboardPath: '/dashboard/db/istio-dashboard',
                  workloadDashboardPath: '/dashboard/db/istio-dashboard'
                }}
              />
            )}
          />
        </MemoryRouter>
      </Provider>
    );
  }, 10000); // Increase timeout for this test
});
