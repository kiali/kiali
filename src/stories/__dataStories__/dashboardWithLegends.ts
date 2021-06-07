import { DashboardModel } from '../../types/Dashboards';

export const dashboardWithlegends: DashboardModel = {
  title: 'Inbound Metrics',
  charts: [
    {
      name: 'Request volume',
      unit: 'ops',
      spans: 6,
      startCollapsed: false,
      metrics: [
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.267],
            [1622625420, 0.267],
            [1622625450, 0.267]
          ],
          name: 'request_count'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.267],
            [1622625420, 0.267],
            [1622625450, 0.267]
          ],
          name: 'request_count'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.267],
            [1622625420, 0.267],
            [1622625450, 0.267]
          ],
          name: 'request_count'
        }
      ],
      error: ''
    },
    {
      name: 'Request duration',
      unit: 'seconds',
      spans: 6,
      startCollapsed: false,
      metrics: [
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.008333],
            [1622625420, 0.008333],
            [1622625450, 0.01]
          ],
          stat: '0.5',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.01],
            [1622625420, 0.015],
            [1622625450, 0.015]
          ],
          stat: '0.5',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.01],
            [1622625420, 0.015],
            [1622625450, 0.008333]
          ],
          stat: '0.5',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.022],
            [1622625420, 0.045],
            [1622625450, 0.0235]
          ],
          stat: '0.95',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.0235],
            [1622625420, 0.024],
            [1622625450, 0.024]
          ],
          stat: '0.95',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.0235],
            [1622625420, 0.024],
            [1622625450, 0.022]
          ],
          stat: '0.95',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.024399999999999998],
            [1622625420, 0.049],
            [1622625450, 0.0247]
          ],
          stat: '0.99',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.0247],
            [1622625420, 0.024800000000000003],
            [1622625450, 0.024800000000000003]
          ],
          stat: '0.99',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.0247],
            [1622625420, 0.024800000000000003],
            [1622625450, 0.024399999999999998]
          ],
          stat: '0.99',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.02494],
            [1622625420, 0.0499],
            [1622625450, 0.02497]
          ],
          stat: '0.999',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.02497],
            [1622625420, 0.024980000000000002],
            [1622625450, 0.024980000000000002]
          ],
          stat: '0.999',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.02497],
            [1622625420, 0.024980000000000002],
            [1622625450, 0.02494]
          ],
          stat: '0.999',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.008163],
            [1622625420, 0.012412000000000001],
            [1622625450, 0.009775]
          ],
          stat: 'avg',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.009275],
            [1622625420, 0.012137],
            [1622625450, 0.015387000000000001]
          ],
          stat: 'avg',
          name: 'request_duration_millis'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 0.011275],
            [1622625420, 0.014138],
            [1622625450, 0.010412000000000001]
          ],
          stat: 'avg',
          name: 'request_duration_millis'
        }
      ],
      error: ''
    },
    {
      name: 'Request throughput',
      unit: 'bitrate',
      spans: 6,
      startCollapsed: false,
      metrics: [
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 1248],
            [1622625420, 1248],
            [1622625450, 1248]
          ],
          name: 'request_throughput'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 1248],
            [1622625420, 1248],
            [1622625450, 1248]
          ],
          name: 'request_throughput'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 1248],
            [1622625420, 1253.336],
            [1622625450, 1248]
          ],
          name: 'request_throughput'
        }
      ],
      error: ''
    },
    {
      name: 'Request size',
      unit: 'bytes',
      spans: 6,
      startCollapsed: false,
      metrics: [
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 750],
            [1622625420, 750],
            [1622625450, 750]
          ],
          stat: '0.5',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 750],
            [1622625420, 750],
            [1622625450, 750]
          ],
          stat: '0.5',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 750],
            [1622625420, 750],
            [1622625450, 750]
          ],
          stat: '0.5',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 975],
            [1622625420, 975],
            [1622625450, 975]
          ],
          stat: '0.95',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 975],
            [1622625420, 975],
            [1622625450, 975]
          ],
          stat: '0.95',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 975],
            [1622625420, 975],
            [1622625450, 975]
          ],
          stat: '0.95',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 995],
            [1622625420, 995],
            [1622625450, 995]
          ],
          stat: '0.99',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 995],
            [1622625420, 995],
            [1622625450, 995]
          ],
          stat: '0.99',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 995],
            [1622625420, 995],
            [1622625450, 995]
          ],
          stat: '0.99',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 999.5],
            [1622625420, 999.5],
            [1622625450, 999.5]
          ],
          stat: '0.999',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 999.5],
            [1622625420, 999.5],
            [1622625450, 999.5]
          ],
          stat: '0.999',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 999.5],
            [1622625420, 999.5],
            [1622625450, 999.5]
          ],
          stat: '0.999',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 585],
            [1622625420, 585],
            [1622625450, 585]
          ],
          stat: 'avg',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 585],
            [1622625420, 585],
            [1622625450, 585]
          ],
          stat: 'avg',
          name: 'request_size'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 585],
            [1622625420, 587.5],
            [1622625450, 585]
          ],
          stat: 'avg',
          name: 'request_size'
        }
      ],
      error: ''
    },
    {
      name: 'Response throughput',
      unit: 'bitrate',
      spans: 6,
      startCollapsed: false,
      metrics: [
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 5066.664],
            [1622625420, 5013.336],
            [1622625450, 5066.664]
          ],
          name: 'response_throughput'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 5066.664],
            [1622625420, 5013.336],
            [1622625450, 5066.664]
          ],
          name: 'response_throughput'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 5013.336],
            [1622625420, 5066.664],
            [1622625450, 5066.664]
          ],
          name: 'response_throughput'
        }
      ],
      error: ''
    },
    {
      name: 'Response size',
      unit: 'bytes',
      spans: 6,
      startCollapsed: false,
      metrics: [
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 2500],
            [1622625420, 2500],
            [1622625450, 2500]
          ],
          stat: '0.5',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 2500],
            [1622625420, 2500],
            [1622625450, 2500]
          ],
          stat: '0.5',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 2500],
            [1622625420, 2500],
            [1622625450, 2500]
          ],
          stat: '0.5',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 4750],
            [1622625420, 4750],
            [1622625450, 4750]
          ],
          stat: '0.95',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 4750],
            [1622625420, 4750],
            [1622625450, 4750]
          ],
          stat: '0.95',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 4750],
            [1622625420, 4750],
            [1622625450, 4750]
          ],
          stat: '0.95',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 4950],
            [1622625420, 4950],
            [1622625450, 4950]
          ],
          stat: '0.99',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 4950],
            [1622625420, 4950],
            [1622625450, 4950]
          ],
          stat: '0.99',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 4950],
            [1622625420, 4950],
            [1622625450, 4950]
          ],
          stat: '0.99',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 4995],
            [1622625420, 4995],
            [1622625450, 4995]
          ],
          stat: '0.999',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 4995],
            [1622625420, 4995],
            [1622625450, 4995]
          ],
          stat: '0.999',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 4995],
            [1622625420, 4995],
            [1622625450, 4995]
          ],
          stat: '0.999',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'travels',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 2375],
            [1622625420, 2350],
            [1622625450, 2375]
          ],
          stat: 'avg',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 2375],
            [1622625420, 2350],
            [1622625450, 2375]
          ],
          stat: 'avg',
          name: 'response_size'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622625390, 2350],
            [1622625420, 2375],
            [1622625450, 2375]
          ],
          stat: 'avg',
          name: 'response_size'
        }
      ],
      error: ''
    },
    {
      name: 'TCP received',
      unit: 'bitrate',
      spans: 6,
      startCollapsed: false,
      metrics: [],
      error: ''
    },
    {
      name: 'TCP sent',
      unit: 'bitrate',
      spans: 6,
      startCollapsed: false,
      metrics: [],
      error: ''
    }
  ],
  aggregations: [
    {
      label: 'destination_canonical_revision',
      displayName: 'Local version',
      singleSelection: false
    },
    {
      label: 'source_workload_namespace',
      displayName: 'Remote namespace',
      singleSelection: false
    },
    {
      label: 'source_canonical_service',
      displayName: 'Remote app',
      singleSelection: false
    },
    {
      label: 'source_canonical_revision',
      displayName: 'Remote version',
      singleSelection: false
    },
    {
      label: 'response_code',
      displayName: 'Response code',
      singleSelection: false
    },
    {
      label: 'grpc_response_status',
      displayName: 'GRPC status',
      singleSelection: false
    },
    {
      label: 'response_flags',
      displayName: 'Response flags',
      singleSelection: false
    }
  ],
  externalLinks: []
};
