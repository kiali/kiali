import * as React from 'react';
import { mount, shallow, ReactWrapper } from 'enzyme';

import ServiceMetrics from '../ServiceMetrics';
import * as API from '../../../services/Api';

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

const mockMetrics = (metrics: any): Promise<void> => {
  return mockAPIToPromise('getServiceMetrics', metrics);
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

describe('ServiceMetrics', () => {
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
    const wrapper = shallow(<ServiceMetrics namespace="ns" service="svc" />);
    expect(wrapper.find('.card-pf-title').map(div => div.text())).toEqual(['Health', 'Input', 'Output']);
  });

  it('mounts and loads empty metrics', done => {
    const allMocksDone = [
      mockMetrics({ metrics: {}, histograms: {} })
        .then(() => {
          mounted!.update();
          expect(mounted!.find('Spinner').map(div => div.getElement().props.loading)).toEqual([]);
          expect(mounted!.find('.card-pf-body')).toHaveLength(2);
          mounted!
            .find('.card-pf-body')
            .forEach(pfCard => expect(pfCard.children().map(div => div.text())).toEqual(['', '', '', '']));
        })
        .catch(err => done.fail(err)),
      mockGrafanaInfo({
        url: 'http://172.30.139.113:3000',
        variablesSuffix: 'svc.cluster.local',
        dashboard: 'istio-dashboard',
        varServiceSource: 'var-source',
        varServiceDest: 'var-http_destination'
      })
        .then(() => {
          mounted!.update();
          expect(mounted!.find('#grafana-out-link > a').map(div => div.getElement().props)).toEqual([
            {
              children: 'View in Grafana',
              href: 'http://172.30.139.113:3000/dashboard/db/istio-dashboard?var-source=svc.ns.svc.cluster.local'
            }
          ]);
          expect(mounted!.find('#grafana-in-link > a').map(div => div.getElement().props)).toEqual([
            {
              children: 'View in Grafana',
              href:
                'http://172.30.139.113:3000/dashboard/db/istio-dashboard?var-http_destination=svc.ns.svc.cluster.local'
            }
          ]);
        })
        .catch(err => done.fail(err))
    ];
    Promise.all(allMocksDone).then(() => done());
    mounted = mount(<ServiceMetrics namespace="ns" service="svc" />);
    expect(mounted.find('Spinner').map(div => div.getElement().props.loading)).toEqual([true]);
  });

  it('mounts and loads full metrics', done => {
    const allMocksDone = [
      mockMetrics({
        metrics: {
          request_count_in: createMetric('m1'),
          request_count_out: createMetric('m2')
        },
        histograms: {
          request_size_in: createHistogram('m3'),
          request_size_out: createHistogram('m4'),
          request_duration_in: createHistogram('m5'),
          request_duration_out: createHistogram('m6'),
          response_size_in: createHistogram('m7'),
          response_size_out: createHistogram('m8')
        }
      })
        .then(() => {
          mounted!.update();
          expect(mounted!.find('Spinner').map(div => div.getElement().props.loading)).toEqual([]);
          expect(mounted!.find('LineChart')).toHaveLength(8);
        })
        .catch(err => done.fail(err)),
      mockGrafanaInfo({})
    ];
    Promise.all(allMocksDone).then(() => done());
    mounted = mount(<ServiceMetrics namespace="ns" service="svc" />);
  });
});
