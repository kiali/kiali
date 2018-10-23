import * as React from 'react';
import { mount, shallow, ReactWrapper } from 'enzyme';

import Metrics from '../Metrics';
import * as API from '../../../services/Api';
import { MetricsDirection, MetricsObjectTypes } from '../../../types/Metrics';

window['SVGPathElement'] = a => a;
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

const mockServiceMetrics = (metrics: any): Promise<void> => {
  return mockAPIToPromise('getServiceMetrics', { source: metrics, dest: metrics });
};

const mockWorkloadMetrics = (metrics: any): Promise<void> => {
  return mockAPIToPromise('getWorkloadMetrics', { source: metrics, dest: metrics });
};

const mockGrafanaInfo = (info: any): Promise<any> => {
  return mockAPIToPromise('getGrafanaInfo', info);
};

const createMetric = (name: string) => {
  return {
    matrix: [
      {
        metric: { __name__: name },
        values: [[1111, 5], [2222, 10]]
      }
    ]
  };
};

const createHistogram = (name: string) => {
  return {
    average: {
      matrix: [
        {
          metric: { __name__: name },
          values: [[1111, 10], [2222, 11]]
        }
      ]
    },
    median: {
      matrix: [
        {
          metric: { __name__: name },
          values: [[1111, 20], [2222, 21]]
        }
      ]
    },
    percentile95: {
      matrix: [
        {
          metric: { __name__: name },
          values: [[1111, 30], [2222, 31]]
        }
      ]
    },
    percentile99: {
      matrix: [
        {
          metric: { __name__: name },
          values: [[1111, 40], [2222, 41]]
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
      <Metrics
        namespace="ns"
        object="svc"
        objectType={MetricsObjectTypes.SERVICE}
        direction={MetricsDirection.INBOUND}
        grafanaInfo={{
          url: 'http://172.30.139.113:3000',
          serviceDashboardPath: '/dashboard/db/istio-dashboard',
          workloadDashboardPath: '/dashboard/db/istio-dashboard',
          varService: 'var-service',
          varNamespace: 'var-namespace',
          varWorkload: 'var-workload'
        }}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('mounts and loads empty metrics', done => {
    const allMocksDone = [
      mockServiceMetrics({ metrics: {}, histograms: {} })
        .then(() => {
          mounted!.update();
          expect(mounted!.find('.card-pf-body')).toHaveLength(1);
          mounted!.find('.card-pf-body').forEach(pfCard => expect(pfCard.children().length === 0));
        })
        .catch(err => done.fail(err))
    ];
    Promise.all(allMocksDone).then(() => done());
    mounted = mount(
      <Metrics
        namespace="ns"
        object="svc"
        objectType={MetricsObjectTypes.SERVICE}
        direction={MetricsDirection.INBOUND}
        grafanaInfo={{
          url: 'http://172.30.139.113:3000',
          serviceDashboardPath: '/dashboard/db/istio-dashboard',
          workloadDashboardPath: '/dashboard/db/istio-dashboard',
          varService: 'var-service',
          varNamespace: 'var-namespace',
          varWorkload: 'var-workload'
        }}
      />
    );
  });

  it(
    'mounts and loads full metrics',
    done => {
      const allMocksDone = [
        mockServiceMetrics({
          metrics: {
            request_count_in: createMetric('m1')
          },
          histograms: {
            request_size_in: createHistogram('m3'),
            request_duration_in: createHistogram('m5'),
            response_size_in: createHistogram('m7')
          }
        })
          .then(() => {
            mounted!.update();
            expect(mounted!.find('LineChart')).toHaveLength(4);
          })
          .catch(err => done.fail(err))
      ];
      Promise.all(allMocksDone).then(() => done());
      mounted = mount(
        <Metrics
          namespace="ns"
          object="svc"
          objectType={MetricsObjectTypes.SERVICE}
          direction={MetricsDirection.INBOUND}
          grafanaInfo={{
            url: 'http://172.30.139.113:3000',
            serviceDashboardPath: '/dashboard/db/istio-dashboard',
            workloadDashboardPath: '/dashboard/db/istio-dashboard',
            varService: 'var-service',
            varNamespace: 'var-namespace',
            varWorkload: 'var-workload'
          }}
        />
      );
    },
    10000
  ); // Increase timeout for this test
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
      <Metrics
        namespace="ns"
        object="svc"
        objectType={MetricsObjectTypes.WORKLOAD}
        direction={MetricsDirection.INBOUND}
        grafanaInfo={{
          url: 'http://172.30.139.113:3000',
          serviceDashboardPath: '/dashboard/db/istio-dashboard',
          workloadDashboardPath: '/dashboard/db/istio-dashboard',
          varService: 'var-service',
          varNamespace: 'var-namespace',
          varWorkload: 'var-workload'
        }}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('mounts and loads empty metrics', done => {
    const allMocksDone = [
      mockWorkloadMetrics({ metrics: {}, histograms: {} })
        .then(() => {
          mounted!.update();
          expect(mounted!.find('.card-pf-body')).toHaveLength(1);
          mounted!.find('.card-pf-body').forEach(pfCard => expect(pfCard.children().length === 0));
        })
        .catch(err => done.fail(err))
    ];
    Promise.all(allMocksDone).then(() => done());
    mounted = mount(
      <Metrics
        namespace="ns"
        object="svc"
        objectType={MetricsObjectTypes.WORKLOAD}
        direction={MetricsDirection.INBOUND}
        grafanaInfo={{
          url: 'http://172.30.139.113:3000',
          serviceDashboardPath: '/dashboard/db/istio-dashboard',
          workloadDashboardPath: '/dashboard/db/istio-dashboard',
          varService: 'var-service',
          varNamespace: 'var-namespace',
          varWorkload: 'var-workload'
        }}
      />
    );
  });

  it(
    'mounts and loads full metrics',
    done => {
      const allMocksDone = [
        mockWorkloadMetrics({
          metrics: {
            request_count_in: createMetric('m1')
          },
          histograms: {
            request_size_in: createHistogram('m3'),
            request_duration_in: createHistogram('m5'),
            response_size_in: createHistogram('m7')
          }
        })
          .then(() => {
            mounted!.update();
            expect(mounted!.find('LineChart')).toHaveLength(4);
          })
          .catch(err => done.fail(err))
      ];
      Promise.all(allMocksDone).then(() => done());
      mounted = mount(
        <Metrics
          namespace="ns"
          object="svc"
          objectType={MetricsObjectTypes.WORKLOAD}
          direction={MetricsDirection.INBOUND}
          grafanaInfo={{
            url: 'http://172.30.139.113:3000',
            serviceDashboardPath: '/dashboard/db/istio-dashboard',
            workloadDashboardPath: '/dashboard/db/istio-dashboard',
            varService: 'var-service',
            varNamespace: 'var-namespace',
            varWorkload: 'var-workload'
          }}
        />
      );
    },
    10000
  ); // Increase timeout for this test
});

describe('Outbound Metrics for a workload', () => {
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
      <Metrics
        namespace="ns"
        object="svc"
        objectType={MetricsObjectTypes.WORKLOAD}
        direction={MetricsDirection.INBOUND}
        grafanaInfo={{
          url: 'http://172.30.139.113:3000',
          serviceDashboardPath: '/dashboard/db/istio-dashboard',
          workloadDashboardPath: '/dashboard/db/istio-dashboard',
          varService: 'var-service',
          varNamespace: 'var-namespace',
          varWorkload: 'var-workload'
        }}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('mounts and loads empty metrics', done => {
    const allMocksDone = [
      mockWorkloadMetrics({ metrics: {}, histograms: {} })
        .then(() => {
          mounted!.update();
          expect(mounted!.find('.card-pf-body')).toHaveLength(1);
          mounted!.find('.card-pf-body').forEach(pfCard => expect(pfCard.children().length === 0));
        })
        .catch(err => done.fail(err))
    ];
    Promise.all(allMocksDone).then(() => done());
    mounted = mount(
      <Metrics
        namespace="ns"
        object="svc"
        objectType={MetricsObjectTypes.WORKLOAD}
        direction={MetricsDirection.INBOUND}
        grafanaInfo={{
          url: 'http://172.30.139.113:3000',
          serviceDashboardPath: '/dashboard/db/istio-dashboard',
          workloadDashboardPath: '/dashboard/db/istio-dashboard',
          varService: 'var-service',
          varNamespace: 'var-namespace',
          varWorkload: 'var-workload'
        }}
      />
    );
  });

  it(
    'mounts and loads full metrics',
    done => {
      const allMocksDone = [
        mockWorkloadMetrics({
          metrics: {
            request_count_out: createMetric('m1')
          },
          histograms: {
            request_size_out: createHistogram('m3'),
            request_duration_out: createHistogram('m5'),
            response_size_out: createHistogram('m7')
          }
        })
          .then(() => {
            mounted!.update();
            expect(mounted!.find('LineChart')).toHaveLength(4);
          })
          .catch(err => done.fail(err))
      ];
      Promise.all(allMocksDone).then(() => done());
      mounted = mount(
        <Metrics
          namespace="ns"
          object="svc"
          objectType={MetricsObjectTypes.WORKLOAD}
          direction={MetricsDirection.OUTBOUND}
          grafanaInfo={{
            url: 'http://172.30.139.113:3000',
            serviceDashboardPath: '/dashboard/db/istio-dashboard',
            workloadDashboardPath: '/dashboard/db/istio-dashboard',
            varService: 'var-service',
            varNamespace: 'var-namespace',
            varWorkload: 'var-workload'
          }}
        />
      );
    },
    10000
  ); // Increase timeout for this test
});
