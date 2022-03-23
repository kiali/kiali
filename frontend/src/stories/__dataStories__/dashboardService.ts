import { DashboardModel } from '../../types/Dashboards';
import { Span } from '../../types/Tracing';
import { buildOverlay } from './helper';

const spans: Span[] = [
  {
    traceID: '996af0fb5068d33d300a654c8022c51c',
    spanID: '52e434ea4a78418a',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622849699821,
    duration: 15655,
    tags: [
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '497319fa-be76-96c2-a6f8-b168eecf7e1a'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '996af0fb5068d33d300a654c8022c51c',
    spanID: '9fc56eff5595bb80',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622849703795,
    duration: 10728,
    tags: [
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '497319fa-be76-96c2-a6f8-b168eecf7e1a'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '8cbffda9d368287d5fc19050b6cddb8f',
    spanID: 'd3fd1ad72dcec820',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622633076666,
    duration: 6849,
    tags: [
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '57aebfd8-7795-929f-ad4f-ebdd30f48cb1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '8cbffda9d368287d5fc19050b6cddb8f',
    spanID: '7b170d53553a1a9c',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622633077298,
    duration: 5670,
    tags: [
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '57aebfd8-7795-929f-ad4f-ebdd30f48cb1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '91c9d3be8b5893178b07111d65f0b3c3',
    spanID: '9fa51929ac14d85',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622956945559,
    duration: 7803,
    tags: [
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '1a4f1751-d9ad-9d41-a369-af1ca75b1a70'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '91c9d3be8b5893178b07111d65f0b3c3',
    spanID: '5d4ed3f4c4745520',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622956946198,
    duration: 6481,
    tags: [
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '1a4f1751-d9ad-9d41-a369-af1ca75b1a70'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '1985e875cf9a4d49c12ea4e44d1aa7a5',
    spanID: '70a38d05693a8ff2',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622595374488,
    duration: 4900,
    tags: [
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'ef74821f-2ba2-91df-861d-bf5a05a74991'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '1985e875cf9a4d49c12ea4e44d1aa7a5',
    spanID: 'f883029cb46959df',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622595374919,
    duration: 3850,
    tags: [
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'ef74821f-2ba2-91df-861d-bf5a05a74991'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '74c230db98fe912757e10fbc5ea68ac2',
    spanID: '2e8a9f38dd52d2f2',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622482444493,
    duration: 12852,
    tags: [
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Tallinn'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'daccbc14-b207-9b70-bd5e-cfad97ec96a4'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '400'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '74c230db98fe912757e10fbc5ea68ac2',
    spanID: 'b53ee55bba9dbc54',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622482445130,
    duration: 11732,
    tags: [
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'daccbc14-b207-9b70-bd5e-cfad97ec96a4'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Tallinn'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '93'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '74c230db98fe912757e10fbc5ea68ac2',
    spanID: '5b9e3e4cf50d3be7',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622482445145,
    duration: 10460,
    tags: [
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'daccbc14-b207-9b70-bd5e-cfad97ec96a4'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '92'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Tallinn'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '74c230db98fe912757e10fbc5ea68ac2',
    spanID: 'b644be991c32fed3',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622482445326,
    duration: 9059,
    tags: [
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '81'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'daccbc14-b207-9b70-bd5e-cfad97ec96a4'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Tallinn'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'd9ab021badc911172d3b281049ca0220',
    spanID: '719ef0b320e666e3',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622827101787,
    duration: 5427,
    tags: [
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '94ba0992-64a9-96b1-90b0-9c04cec390aa'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'd9ab021badc911172d3b281049ca0220',
    spanID: '936d32350a4db6fb',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622827102232,
    duration: 4541,
    tags: [
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '94ba0992-64a9-96b1-90b0-9c04cec390aa'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '709573761a949df9c5b73bee23faba3b',
    spanID: 'd713d54d1bb70546',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622677420945,
    duration: 11563,
    tags: [
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'ce79d426-648b-90c0-bbce-573fd541c849'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '709573761a949df9c5b73bee23faba3b',
    spanID: '4b87976be448a0b9',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622677421748,
    duration: 9751,
    tags: [
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'ce79d426-648b-90c0-bbce-573fd541c849'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '5096f1bb1f82fe0ba0aef59dae44317b',
    spanID: '82174df462a205bf',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622963950115,
    duration: 16036,
    tags: [
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Zagreb'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '402'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'efca6c4b-416c-99c6-9e92-dbe8cbb91a3c'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '5096f1bb1f82fe0ba0aef59dae44317b',
    spanID: 'a9fc0f189c99b016',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622963951078,
    duration: 14653,
    tags: [
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Zagreb'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '96'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'efca6c4b-416c-99c6-9e92-dbe8cbb91a3c'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '5096f1bb1f82fe0ba0aef59dae44317b',
    spanID: 'aafbe2cafa4cd96c',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622963951081,
    duration: 14388,
    tags: [
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '91'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Zagreb'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'efca6c4b-416c-99c6-9e92-dbe8cbb91a3c'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '5096f1bb1f82fe0ba0aef59dae44317b',
    spanID: '9be74f53895a8835',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622963951274,
    duration: 14688,
    tags: [
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Zagreb'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'efca6c4b-416c-99c6-9e92-dbe8cbb91a3c'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '82'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '979cbf4b2cffd965ff4b2139361c6bdf',
    spanID: 'aeafa22a7c6deda',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622911706570,
    duration: 8064,
    tags: [
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'bb4858d1-f79b-9887-9347-d3712595ee90'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '979cbf4b2cffd965ff4b2139361c6bdf',
    spanID: '4f8173073bf83c31',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622911707324,
    duration: 6350,
    tags: [
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'bb4858d1-f79b-9887-9347-d3712595ee90'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '54c541fbddcd40a5108f40e9455c6c54',
    spanID: '107f11e72a322163',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622467386665,
    duration: 12804,
    tags: [
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '8609373c-011b-90cd-8e0d-3f63e1a50327'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Lisbon'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '509'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '54c541fbddcd40a5108f40e9455c6c54',
    spanID: '89169728f071473d',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622467387237,
    duration: 11958,
    tags: [
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Lisbon'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '8609373c-011b-90cd-8e0d-3f63e1a50327'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '90'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '54c541fbddcd40a5108f40e9455c6c54',
    spanID: 'd95948865a0decdd',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622467387261,
    duration: 9420,
    tags: [
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '88'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '8609373c-011b-90cd-8e0d-3f63e1a50327'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Lisbon'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '54c541fbddcd40a5108f40e9455c6c54',
    spanID: '5e37eb8d5b2060d0',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622467387445,
    duration: 11272,
    tags: [
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Lisbon'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '8609373c-011b-90cd-8e0d-3f63e1a50327'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '79'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '54c541fbddcd40a5108f40e9455c6c54',
    spanID: '40435282f029d527',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622467387753,
    duration: 10577,
    tags: [
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Lisbon'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '124'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '8609373c-011b-90cd-8e0d-3f63e1a50327'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '1d08e1c2e82c2d6b24899e2829280378',
    spanID: 'c841a83ce27c513',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622422187735,
    duration: 16129,
    tags: [
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Tallinn'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'b90767f0-0969-9373-85b0-a3a71d9eb13e'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '521'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '1d08e1c2e82c2d6b24899e2829280378',
    spanID: 'de17cd009ac06bf6',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622422188153,
    duration: 13220,
    tags: [
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Tallinn'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'b90767f0-0969-9373-85b0-a3a71d9eb13e'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '92'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '1d08e1c2e82c2d6b24899e2829280378',
    spanID: 'd037ccf05651da04',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622422188331,
    duration: 12256,
    tags: [
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '93'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'b90767f0-0969-9373-85b0-a3a71d9eb13e'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Tallinn'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '1d08e1c2e82c2d6b24899e2829280378',
    spanID: '488ab7abdee637f6',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622422188337,
    duration: 15216,
    tags: [
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'b90767f0-0969-9373-85b0-a3a71d9eb13e'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Tallinn'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '126'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '1d08e1c2e82c2d6b24899e2829280378',
    spanID: '6dfec4787e0b1789',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622422188583,
    duration: 9271,
    tags: [
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'b90767f0-0969-9373-85b0-a3a71d9eb13e'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Tallinn'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '81'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '6048c02fe11ce60e278ba92beb32d4d7',
    spanID: '9def1d76528b7e40',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622761082519,
    duration: 22464,
    tags: [
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/London'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '860c8ffd-e306-915b-942c-84de35d6be6e'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '536'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '6048c02fe11ce60e278ba92beb32d4d7',
    spanID: '9d572db20816ff53',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622761083293,
    duration: 19179,
    tags: [
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/London'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '91'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '860c8ffd-e306-915b-942c-84de35d6be6e'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '6048c02fe11ce60e278ba92beb32d4d7',
    spanID: 'b5c14ab9a285b004',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622761083515,
    duration: 16958,
    tags: [
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '860c8ffd-e306-915b-942c-84de35d6be6e'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '96'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/London'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '6048c02fe11ce60e278ba92beb32d4d7',
    spanID: '25845b82b010bacb',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622761083546,
    duration: 20895,
    tags: [
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '860c8ffd-e306-915b-942c-84de35d6be6e'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/London'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '140'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '6048c02fe11ce60e278ba92beb32d4d7',
    spanID: 'aed7a91a0fa9b51e',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622761083900,
    duration: 14957,
    tags: [
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '860c8ffd-e306-915b-942c-84de35d6be6e'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/London'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '81'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'a225e6888ba62ec57b4c1867b06500fa',
    spanID: '77447e91e5de9dad',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622804504284,
    duration: 9520,
    tags: [
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '3059a121-5c41-9a69-b5de-faab950eade3'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'a225e6888ba62ec57b4c1867b06500fa',
    spanID: '980d4191dcc7076f',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622804505170,
    duration: 7564,
    tags: [
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '3059a121-5c41-9a69-b5de-faab950eade3'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'e013021796fbcc78c6299184c7e277ae',
    spanID: '16c2ef2499ea4446',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622767907668,
    duration: 16194,
    tags: [
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '9861b6b2-252d-93af-97ba-5ed9e8954572'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '519'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Budapest'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'e013021796fbcc78c6299184c7e277ae',
    spanID: '916fe3dae284db46',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622767908136,
    duration: 12305,
    tags: [
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '96'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Budapest'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '9861b6b2-252d-93af-97ba-5ed9e8954572'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'e013021796fbcc78c6299184c7e277ae',
    spanID: 'fd4bcc706d204b6c',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622767908261,
    duration: 13350,
    tags: [
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Budapest'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '92'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '9861b6b2-252d-93af-97ba-5ed9e8954572'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'e013021796fbcc78c6299184c7e277ae',
    spanID: 'fa0d89af32f0e8e0',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622767908329,
    duration: 14876,
    tags: [
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '122'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Budapest'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '9861b6b2-252d-93af-97ba-5ed9e8954572'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'e013021796fbcc78c6299184c7e277ae',
    spanID: 'd902faf4a79711e7',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622767908467,
    duration: 14552,
    tags: [
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '79'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Budapest'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '9861b6b2-252d-93af-97ba-5ed9e8954572'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'cb87bbff04b49c2d56df0bf6f3dc73c6',
    spanID: 'c9e2a5ccdc61f492',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622571833474,
    duration: 13394,
    tags: [
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Dublin'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f978256b-1d9b-9b99-93f4-f5d0a6451d6d'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '459'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'cb87bbff04b49c2d56df0bf6f3dc73c6',
    spanID: '334f15a19e4390d2',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622571834726,
    duration: 8551,
    tags: [
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '89'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Dublin'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f978256b-1d9b-9b99-93f4-f5d0a6451d6d'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'cb87bbff04b49c2d56df0bf6f3dc73c6',
    spanID: '4844be8554209fcf',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622571834952,
    duration: 11377,
    tags: [
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Dublin'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '140'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f978256b-1d9b-9b99-93f4-f5d0a6451d6d'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'cb87bbff04b49c2d56df0bf6f3dc73c6',
    spanID: '3063367baaa60e80',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622571835292,
    duration: 11303,
    tags: [
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f978256b-1d9b-9b99-93f4-f5d0a6451d6d'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Dublin'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '97'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'be1a2ed43db4bdb30977580451be387f',
    spanID: 'bc37c1cfe305627f',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622405292320,
    duration: 21443,
    tags: [
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Kiev'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '517'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '7739b4aa-796a-9738-aada-dab0d5987e26'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'be1a2ed43db4bdb30977580451be387f',
    spanID: '262d3422b50207c6',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622405292787,
    duration: 19834,
    tags: [
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '7739b4aa-796a-9738-aada-dab0d5987e26'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '96'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Kiev'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'be1a2ed43db4bdb30977580451be387f',
    spanID: 'ad815f9418875c2a',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622405292921,
    duration: 11373,
    tags: [
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '128'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '7739b4aa-796a-9738-aada-dab0d5987e26'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Kiev'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'be1a2ed43db4bdb30977580451be387f',
    spanID: 'effa7491a1931d6d',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622405293061,
    duration: 17668,
    tags: [
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '7739b4aa-796a-9738-aada-dab0d5987e26'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Kiev'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '81'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'be1a2ed43db4bdb30977580451be387f',
    spanID: 'f4d0f083df6fbb0f',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622405293254,
    duration: 19117,
    tags: [
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '7739b4aa-796a-9738-aada-dab0d5987e26'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Kiev'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '86'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '3be163f5d0e360526300f9607c68cf98',
    spanID: '226d050cda50ac02',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622820678142,
    duration: 4905,
    tags: [
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'b85aac80-1864-9072-9938-270b3541e34d'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '3be163f5d0e360526300f9607c68cf98',
    spanID: 'cc5a0bf9550f6d56',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622820678675,
    duration: 3923,
    tags: [
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'b85aac80-1864-9072-9938-270b3541e34d'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '96297fecabaa5bd1eac65c89180818ce',
    spanID: 'c835e2e2eb35b133',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622730944266,
    duration: 8729,
    tags: [
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f16752f5-55f6-966d-83b0-e6591f4a71eb'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '96297fecabaa5bd1eac65c89180818ce',
    spanID: 'd381d1feae6afc2c',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622730944782,
    duration: 7501,
    tags: [
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f16752f5-55f6-966d-83b0-e6591f4a71eb'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '81d08edaa9e4521ae7b338825225634e',
    spanID: '1f35de640997e80',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622391155152,
    duration: 12915,
    tags: [
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Nicosia'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '444'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f65efc87-950c-99fd-beab-b00500b96727'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '81d08edaa9e4521ae7b338825225634e',
    spanID: '9c01bd73a3df2930',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622391155663,
    duration: 10176,
    tags: [
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f65efc87-950c-99fd-beab-b00500b96727'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '89'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Nicosia'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '81d08edaa9e4521ae7b338825225634e',
    spanID: '9f5418d580ddf6bb',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622391155905,
    duration: 10292,
    tags: [
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Nicosia'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f65efc87-950c-99fd-beab-b00500b96727'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '128'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '81d08edaa9e4521ae7b338825225634e',
    spanID: '688e25175bd692d9',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622391156105,
    duration: 11356,
    tags: [
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f65efc87-950c-99fd-beab-b00500b96727'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '93'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Nicosia'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'b7e132974d7117afa7c42c6fc3e1ad3d',
    spanID: '11db1515ff784a8b',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622345917411,
    duration: 4639,
    tags: [
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '87a3d0f5-d212-94e1-a494-da8330d9cd84'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'b7e132974d7117afa7c42c6fc3e1ad3d',
    spanID: 'e040c6346081129e',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622345917835,
    duration: 3680,
    tags: [
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '87a3d0f5-d212-94e1-a494-da8330d9cd84'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'a4479be72836ec36e1de37584e5fad75',
    spanID: 'e91a8ed8eb3c6bb3',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622344996921,
    duration: 17357,
    tags: [
      {
        key: 'response_size',
        type: 'string',
        value: '441'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '91856e32-9d2e-9870-a90a-55aab568176a'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Kiev'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'a4479be72836ec36e1de37584e5fad75',
    spanID: 'd74f6408386eaf67',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622344997576,
    duration: 15463,
    tags: [
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '91856e32-9d2e-9870-a90a-55aab568176a'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '96'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Kiev'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'a4479be72836ec36e1de37584e5fad75',
    spanID: '9a8878d9cd5bae1b',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622344997757,
    duration: 11892,
    tags: [
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '91856e32-9d2e-9870-a90a-55aab568176a'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Kiev'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '86'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'a4479be72836ec36e1de37584e5fad75',
    spanID: '82c1160f520ba180',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622344997845,
    duration: 15730,
    tags: [
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '128'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Kiev'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '91856e32-9d2e-9870-a90a-55aab568176a'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'dacdcf510fe5427da211220fd5a8a74c',
    spanID: '931d4185609974c0',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622864788632,
    duration: 9876,
    tags: [
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f7a7aa5a-b0da-997b-a333-7892a182bf15'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'dacdcf510fe5427da211220fd5a8a74c',
    spanID: 'c7443c49a92f3a5b',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622864789766,
    duration: 8164,
    tags: [
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f7a7aa5a-b0da-997b-a333-7892a182bf15'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '804d78e9dc656838e03f78ee13b366dc',
    spanID: 'e125b62bc5531fd0',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622775442762,
    duration: 17653,
    tags: [
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '735f622d-2bff-966d-82b9-6861dbb48b56'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Tirana'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '450'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '804d78e9dc656838e03f78ee13b366dc',
    spanID: 'd0ec5a809057b5b3',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622775443596,
    duration: 15419,
    tags: [
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Tirana'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '92'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '735f622d-2bff-966d-82b9-6861dbb48b56'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '804d78e9dc656838e03f78ee13b366dc',
    spanID: 'cd21e4cac15adb0f',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622775443719,
    duration: 16254,
    tags: [
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '94'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '735f622d-2bff-966d-82b9-6861dbb48b56'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Tirana'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '804d78e9dc656838e03f78ee13b366dc',
    spanID: '160116e9f85d0099',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622775443894,
    duration: 15384,
    tags: [
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '131'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '735f622d-2bff-966d-82b9-6861dbb48b56'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Tirana'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '13a774f38637b8a01931f9ca6c473712',
    spanID: 'ba1923b06b803ae2',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622640613526,
    duration: 13144,
    tags: [
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '402'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Nicosia'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '1089ddac-5a67-98ee-bbb9-267aaea0baee'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '13a774f38637b8a01931f9ca6c473712',
    spanID: '39f056cacd4ed01c',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622640614230,
    duration: 10565,
    tags: [
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '1089ddac-5a67-98ee-bbb9-267aaea0baee'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Nicosia'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '89'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '13a774f38637b8a01931f9ca6c473712',
    spanID: '2656fda72dc9c196',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622640614555,
    duration: 11600,
    tags: [
      {
        key: 'response_size',
        type: 'string',
        value: '86'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '1089ddac-5a67-98ee-bbb9-267aaea0baee'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Nicosia'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '13a774f38637b8a01931f9ca6c473712',
    spanID: '17f27959050e7fab',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622640614591,
    duration: 11555,
    tags: [
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '93'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '1089ddac-5a67-98ee-bbb9-267aaea0baee'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Nicosia'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '60b8c843051059a51f934e95d9c0c380',
    spanID: '1a99ae83151b3b85',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622556748468,
    duration: 7505,
    tags: [
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '876542e3-286b-98bc-9342-403aed8fa4fc'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '60b8c843051059a51f934e95d9c0c380',
    spanID: '8398617405c74903',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622556749311,
    duration: 5727,
    tags: [
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '876542e3-286b-98bc-9342-403aed8fa4fc'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'd53274e7c86cf86c5392dd4b00f90b82',
    spanID: 'd086383cd1dee8a0',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622458908794,
    duration: 11889,
    tags: [
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'ee4b46bf-8e5f-92e3-ae0a-01052f42e08a'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '445'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Podgorica'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'd53274e7c86cf86c5392dd4b00f90b82',
    spanID: '23f114ad2881c88a',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622458909417,
    duration: 10795,
    tags: [
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Podgorica'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '90'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'ee4b46bf-8e5f-92e3-ae0a-01052f42e08a'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'd53274e7c86cf86c5392dd4b00f90b82',
    spanID: 'e98404364a6595f',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622458909421,
    duration: 10146,
    tags: [
      {
        key: 'response_size',
        type: 'string',
        value: '95'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'ee4b46bf-8e5f-92e3-ae0a-01052f42e08a'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Podgorica'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'd53274e7c86cf86c5392dd4b00f90b82',
    spanID: '13f01e819368f2fa',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622458909563,
    duration: 10841,
    tags: [
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '124'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'ee4b46bf-8e5f-92e3-ae0a-01052f42e08a'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Podgorica'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'da540345315da9d7ddae40f5b13f3efb',
    spanID: '975a27102bf01e4b',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622821321247,
    duration: 8281,
    tags: [
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '537583da-4ef5-9668-a00c-077823644ea2'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'da540345315da9d7ddae40f5b13f3efb',
    spanID: 'a80718f87413abc1',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622821322064,
    duration: 6769,
    tags: [
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '537583da-4ef5-9668-a00c-077823644ea2'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '2fb9d80765b7aec8054f83e00dd4aa0b',
    spanID: 'f30f5e30b795abf8',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622753534188,
    duration: 6094,
    tags: [
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'ae427230-9629-9e02-9d3f-f270573de82f'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '2fb9d80765b7aec8054f83e00dd4aa0b',
    spanID: 'c500e6680188138c',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622753534956,
    duration: 4790,
    tags: [
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'ae427230-9629-9e02-9d3f-f270573de82f'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'b1c68e6b4902455a20ba85c859f470b9',
    spanID: 'f80f59ddbec79978',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622451380516,
    duration: 19680,
    tags: [
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Riga'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'c0662a67-6360-9da5-9830-2480781788f8'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '536'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'b1c68e6b4902455a20ba85c859f470b9',
    spanID: '56c8365f86d3380f',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622451381211,
    duration: 16289,
    tags: [
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '94'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Riga'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'c0662a67-6360-9da5-9830-2480781788f8'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'b1c68e6b4902455a20ba85c859f470b9',
    spanID: '183e19cea663e614',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622451381304,
    duration: 18237,
    tags: [
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Riga'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '132'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'c0662a67-6360-9da5-9830-2480781788f8'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'b1c68e6b4902455a20ba85c859f470b9',
    spanID: '2f58618bc912b337',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622451381467,
    duration: 17240,
    tags: [
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Riga'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'c0662a67-6360-9da5-9830-2480781788f8'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '84'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'b1c68e6b4902455a20ba85c859f470b9',
    spanID: '4a3a939eb3d24309',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622451381579,
    duration: 16817,
    tags: [
      {
        key: 'response_size',
        type: 'string',
        value: '100'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Riga'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'c0662a67-6360-9da5-9830-2480781788f8'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '78385db35085f34a2476a23594583049',
    spanID: '152386982b5ef8f9',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622406218066,
    duration: 21064,
    tags: [
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '528'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'd6b62327-7a77-9a7c-851f-0d342e0ec79f'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Prague'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '78385db35085f34a2476a23594583049',
    spanID: 'ba9951589a69f84c',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622406218743,
    duration: 19565,
    tags: [
      {
        key: 'response_size',
        type: 'string',
        value: '91'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Prague'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'd6b62327-7a77-9a7c-851f-0d342e0ec79f'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '78385db35085f34a2476a23594583049',
    spanID: '6973ebcb08dbc298',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622406218986,
    duration: 11790,
    tags: [
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '128'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'd6b62327-7a77-9a7c-851f-0d342e0ec79f'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Prague'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '78385db35085f34a2476a23594583049',
    spanID: '4755c78c8790379d',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622406219146,
    duration: 15928,
    tags: [
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '88'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Prague'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'd6b62327-7a77-9a7c-851f-0d342e0ec79f'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '78385db35085f34a2476a23594583049',
    spanID: '171d8a806374807c',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622406219489,
    duration: 19397,
    tags: [
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'd6b62327-7a77-9a7c-851f-0d342e0ec79f'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Prague'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '93'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'b8fcc7dbcc4844343cdc59bd963030b4',
    spanID: '7c26f747c93cdbaf',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622473024659,
    duration: 9955,
    tags: [
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '8a36657e-b4ab-95df-96db-864f78067af5'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'b8fcc7dbcc4844343cdc59bd963030b4',
    spanID: 'fd9e4dd947bc40e3',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622473025298,
    duration: 8777,
    tags: [
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '8a36657e-b4ab-95df-96db-864f78067af5'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'f1afde4b00bdce205a5b97fe47128892',
    spanID: '40fb4b12e886081b',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622398670645,
    duration: 7071,
    tags: [
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'd9edf65b-7e33-9537-95a6-2d8f3ebe6cbe'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'f1afde4b00bdce205a5b97fe47128892',
    spanID: 'f7c4e200ebff361f',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622398671757,
    duration: 5307,
    tags: [
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'd9edf65b-7e33-9537-95a6-2d8f3ebe6cbe'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '3de9a2ae3f001c61c3f261122e0d1d7d',
    spanID: 'ecbcd62a122b1331',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622813114474,
    duration: 21309,
    tags: [
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '51ea78e7-a486-9f71-a380-15876715e11b'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '3de9a2ae3f001c61c3f261122e0d1d7d',
    spanID: '24795b78fdd0adfb',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622813114989,
    duration: 20140,
    tags: [
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '51ea78e7-a486-9f71-a380-15876715e11b'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '48f2a79b42bbe51a90993fc2dd2ec09b',
    spanID: '8aa0ee2051f1fafd',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622377005589,
    duration: 7644,
    tags: [
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'c2e6de19-e30d-960d-a288-76bfe4d1301d'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '48f2a79b42bbe51a90993fc2dd2ec09b',
    spanID: '15e517eedc6fbdc3',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622377006180,
    duration: 6302,
    tags: [
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'c2e6de19-e30d-960d-a288-76bfe4d1301d'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'b5998c8b7e55bb4459885df6f92207e1',
    spanID: '108375255b65abb5',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622955224085,
    duration: 6405,
    tags: [
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '7970904c-dd84-925d-b325-ddeffae95d0a'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'b5998c8b7e55bb4459885df6f92207e1',
    spanID: '5f18c1efd1c4480',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622955225428,
    duration: 4388,
    tags: [
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '7970904c-dd84-925d-b325-ddeffae95d0a'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'ca19d5299621fc6a676b3b3a5b4a4c3c',
    spanID: '76c1c901f4bb3979',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622413747534,
    duration: 12240,
    tags: [
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '430'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Rome'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'fc496e70-55b8-9f81-88b1-3eb9564b1ed6'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'ca19d5299621fc6a676b3b3a5b4a4c3c',
    spanID: 'f0a951d4dde87d3b',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622413748120,
    duration: 10686,
    tags: [
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Rome'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'fc496e70-55b8-9f81-88b1-3eb9564b1ed6'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '85'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'ca19d5299621fc6a676b3b3a5b4a4c3c',
    spanID: 'f5e3de5b74c63a6e',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622413748131,
    duration: 11314,
    tags: [
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Rome'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '90'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'fc496e70-55b8-9f81-88b1-3eb9564b1ed6'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'ca19d5299621fc6a676b3b3a5b4a4c3c',
    spanID: 'b2740ad120096ca4',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622413748285,
    duration: 10608,
    tags: [
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '124'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'fc496e70-55b8-9f81-88b1-3eb9564b1ed6'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Rome'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'f6483e16403f5496f85e6cc66dbb5073',
    spanID: 'ce1e415e4dd17eeb',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622926253383,
    duration: 25675,
    tags: [
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Chisinau'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '534'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'e81c9fb8-c39a-9356-92e3-5cc1bd1c59c6'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'f6483e16403f5496f85e6cc66dbb5073',
    spanID: 'fed07f8de00999cd',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622926254031,
    duration: 22128,
    tags: [
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Chisinau'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '92'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'e81c9fb8-c39a-9356-92e3-5cc1bd1c59c6'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'f6483e16403f5496f85e6cc66dbb5073',
    spanID: 'c7f706aefabfe0d3',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622926254271,
    duration: 13516,
    tags: [
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Chisinau'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'e81c9fb8-c39a-9356-92e3-5cc1bd1c59c6'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '131'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'f6483e16403f5496f85e6cc66dbb5073',
    spanID: 'e827d1defc55a4dd',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622926254546,
    duration: 19879,
    tags: [
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '84'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'e81c9fb8-c39a-9356-92e3-5cc1bd1c59c6'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Chisinau'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'f6483e16403f5496f85e6cc66dbb5073',
    spanID: '924355ce3cfbfb90',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622926254886,
    duration: 22784,
    tags: [
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'e81c9fb8-c39a-9356-92e3-5cc1bd1c59c6'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '97'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Chisinau'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'af6a0c02a656b275f8ae577213d16031',
    spanID: 'd936b065ec56e8c0',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622805595313,
    duration: 14583,
    tags: [
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f4f449ce-3ae8-9e6a-bb3f-6c692c1491b0'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Moscow'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '402'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'af6a0c02a656b275f8ae577213d16031',
    spanID: 'c25f48b40f82c24e',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622805595996,
    duration: 13279,
    tags: [
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '92'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Moscow'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f4f449ce-3ae8-9e6a-bb3f-6c692c1491b0'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'af6a0c02a656b275f8ae577213d16031',
    spanID: 'fc1b6e59a929cae2',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622805596143,
    duration: 13172,
    tags: [
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '93'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f4f449ce-3ae8-9e6a-bb3f-6c692c1491b0'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Moscow'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'af6a0c02a656b275f8ae577213d16031',
    spanID: 'aafbdf863c3ad2a7',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622805596302,
    duration: 12001,
    tags: [
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '84'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f4f449ce-3ae8-9e6a-bb3f-6c692c1491b0'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Moscow'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '1eb63caa35e69a2133ddf5a6b6a489f3',
    spanID: 'a9a288969053cf4',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622791233075,
    duration: 10642,
    tags: [
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '376e8928-a0b8-9c8b-9672-9554424ca472'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '444'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Reykjavik'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '1eb63caa35e69a2133ddf5a6b6a489f3',
    spanID: '472e0d999c24d1fe',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622791233497,
    duration: 9737,
    tags: [
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Reykjavik'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '91'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '376e8928-a0b8-9c8b-9672-9554424ca472'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '1eb63caa35e69a2133ddf5a6b6a489f3',
    spanID: '681dc85f29c45f4c',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622791233590,
    duration: 9572,
    tags: [
      {
        key: 'response_size',
        type: 'string',
        value: '95'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Reykjavik'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '376e8928-a0b8-9c8b-9672-9554424ca472'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '1eb63caa35e69a2133ddf5a6b6a489f3',
    spanID: '783cd55a18e22a96',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622791233637,
    duration: 9773,
    tags: [
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Reykjavik'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '376e8928-a0b8-9c8b-9672-9554424ca472'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '122'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'f07a9f4ff89ec2e48ab7cd9f518c1190',
    spanID: 'd5804d5a46232494',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622782964396,
    duration: 5551,
    tags: [
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f85d6522-5033-93fc-b630-d89f4b73fe03'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'f07a9f4ff89ec2e48ab7cd9f518c1190',
    spanID: 'b5165b57da158a65',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622782964837,
    duration: 4662,
    tags: [
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f85d6522-5033-93fc-b630-d89f4b73fe03'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'd7679c8c4d72973e0581c2262beff99e',
    spanID: 'a15d0366cdc91631',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622518186799,
    duration: 5984,
    tags: [
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'e88e9c45-f698-9caa-824b-cb6d1729eba1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'd7679c8c4d72973e0581c2262beff99e',
    spanID: '905bd41d12da527d',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622518187482,
    duration: 4818,
    tags: [
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'e88e9c45-f698-9caa-824b-cb6d1729eba1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'd235c038b63afaba882ce25d6702a387',
    spanID: 'c0a8247eb267bac',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622879853341,
    duration: 17758,
    tags: [
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '5220cb82-386d-93a2-a4a6-b1bfeeeccb91'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Rome'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '504'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'd235c038b63afaba882ce25d6702a387',
    spanID: '6d003979e0e9e2d5',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622879854106,
    duration: 10974,
    tags: [
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '85'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Rome'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '5220cb82-386d-93a2-a4a6-b1bfeeeccb91'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'd235c038b63afaba882ce25d6702a387',
    spanID: 'f5a85e5620b21bf3',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622879854109,
    duration: 16621,
    tags: [
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Rome'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '79'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '5220cb82-386d-93a2-a4a6-b1bfeeeccb91'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'd235c038b63afaba882ce25d6702a387',
    spanID: '92285909b39446fd',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622879854246,
    duration: 12658,
    tags: [
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '5220cb82-386d-93a2-a4a6-b1bfeeeccb91'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Rome'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '124'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'd235c038b63afaba882ce25d6702a387',
    spanID: '6be8a9978d1e760',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622879854340,
    duration: 8825,
    tags: [
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Rome'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '90'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '5220cb82-386d-93a2-a4a6-b1bfeeeccb91'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'e11a7c24a618942971766a89214b96f3',
    spanID: 'dd77f5154129a378',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622866554327,
    duration: 13138,
    tags: [
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '76fe33e1-2e25-9d2f-bf4e-7e179940d2cc'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Amsterdam'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '417'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'e11a7c24a618942971766a89214b96f3',
    spanID: '231a79b9255910c9',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622866555005,
    duration: 11265,
    tags: [
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Amsterdam'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '76fe33e1-2e25-9d2f-bf4e-7e179940d2cc'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '95'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'e11a7c24a618942971766a89214b96f3',
    spanID: '80c20b09eb1076a1',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622866555260,
    duration: 11360,
    tags: [
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '76fe33e1-2e25-9d2f-bf4e-7e179940d2cc'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '83'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Amsterdam'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'e11a7c24a618942971766a89214b96f3',
    spanID: '5855484604a27b8c',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622866555540,
    duration: 11443,
    tags: [
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '76fe33e1-2e25-9d2f-bf4e-7e179940d2cc'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '103'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Amsterdam'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '4cc127d3082ae0588cf8c8836d365fba',
    spanID: 'e0b4b79efb826f46',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622776147405,
    duration: 5836,
    tags: [
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '37fee1b4-88ae-947a-9ad0-b83491e8e877'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '4cc127d3082ae0588cf8c8836d365fba',
    spanID: 'a6bc6c3d6211ab0e',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622776147991,
    duration: 4599,
    tags: [
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '37fee1b4-88ae-947a-9ad0-b83491e8e877'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '496766d469ab5c8dd58d4f2cd75d26f2',
    spanID: '5ba41be30a7ebce0',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622752833234,
    duration: 5569,
    tags: [
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '1a41a870-fdbf-99a3-83e6-73bc80973555'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '496766d469ab5c8dd58d4f2cd75d26f2',
    spanID: 'db44afb73f7374f3',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622752833773,
    duration: 4592,
    tags: [
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '1a41a870-fdbf-99a3-83e6-73bc80973555'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '93f4bbdcc3222696f3286e8bb2c853cc',
    spanID: '30447aa81b52d1a1',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622730230651,
    duration: 14063,
    tags: [
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '5e21c274-2f6c-90ad-b095-64a731f882a2'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Tallinn'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '445'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '93f4bbdcc3222696f3286e8bb2c853cc',
    spanID: 'f9e92e1b51b11b05',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622730231758,
    duration: 12558,
    tags: [
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '126'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Tallinn'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '5e21c274-2f6c-90ad-b095-64a731f882a2'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '93f4bbdcc3222696f3286e8bb2c853cc',
    spanID: 'c7abe3fea92558b9',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622730231820,
    duration: 9676,
    tags: [
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '93'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Tallinn'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '5e21c274-2f6c-90ad-b095-64a731f882a2'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '93f4bbdcc3222696f3286e8bb2c853cc',
    spanID: 'fa7f45e33d775911',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622730232026,
    duration: 11378,
    tags: [
      {
        key: 'response_size',
        type: 'string',
        value: '92'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '5e21c274-2f6c-90ad-b095-64a731f882a2'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Tallinn'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '4950035ff36c8194310a6f6e69e43ef4',
    spanID: '4bf6d084f0b9ad4d',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622495618996,
    duration: 13949,
    tags: [
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Copenhagen'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '67f3ccbb-9b13-9e55-ae91-6f2ef55b84c0'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '535'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '4950035ff36c8194310a6f6e69e43ef4',
    spanID: '7734fc03980e2cec',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622495619569,
    duration: 12344,
    tags: [
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '67f3ccbb-9b13-9e55-ae91-6f2ef55b84c0'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Copenhagen'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '96'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '4950035ff36c8194310a6f6e69e43ef4',
    spanID: '65e9ded80455f181',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622495619723,
    duration: 12872,
    tags: [
      {
        key: 'response_size',
        type: 'string',
        value: '128'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '67f3ccbb-9b13-9e55-ae91-6f2ef55b84c0'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Copenhagen'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '4950035ff36c8194310a6f6e69e43ef4',
    spanID: '580c52d33a28cd9b',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622495619820,
    duration: 11913,
    tags: [
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Copenhagen'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '81'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '67f3ccbb-9b13-9e55-ae91-6f2ef55b84c0'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '4950035ff36c8194310a6f6e69e43ef4',
    spanID: '303507883a310501',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622495620008,
    duration: 8784,
    tags: [
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '67f3ccbb-9b13-9e55-ae91-6f2ef55b84c0'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Copenhagen'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '98'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'd6405c89db2bcd8a7625e1ccdc06861b',
    spanID: '4482e1fe309f58ff',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622473959319,
    duration: 28205,
    tags: [
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Podgorica'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '48987358-18e8-9acd-97d3-51b4e448fd22'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '519'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'd6405c89db2bcd8a7625e1ccdc06861b',
    spanID: '198fbd4495659dc1',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622473959839,
    duration: 11939,
    tags: [
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Podgorica'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '95'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '48987358-18e8-9acd-97d3-51b4e448fd22'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'd6405c89db2bcd8a7625e1ccdc06861b',
    spanID: '41f2598caf17c8e8',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622473959900,
    duration: 18230,
    tags: [
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '48987358-18e8-9acd-97d3-51b4e448fd22'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '90'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Podgorica'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'd6405c89db2bcd8a7625e1ccdc06861b',
    spanID: '7d839b6ded558dac',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622473960044,
    duration: 22575,
    tags: [
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '79'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '48987358-18e8-9acd-97d3-51b4e448fd22'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Podgorica'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: 'd6405c89db2bcd8a7625e1ccdc06861b',
    spanID: 'b1d85e4fe26e5022',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622473961348,
    duration: 17484,
    tags: [
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Podgorica'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '48987358-18e8-9acd-97d3-51b4e448fd22'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '124'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '27f6402afd05cf1c0263d3ae2c2700bf',
    spanID: 'd9c40e9334e6d540',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622375112907,
    duration: 15121,
    tags: [
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '567ad4f0-81d9-9f99-9b71-8e337e3f60b7'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '404'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Moscow'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '27f6402afd05cf1c0263d3ae2c2700bf',
    spanID: '22175a930547a72',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622375114302,
    duration: 12977,
    tags: [
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Moscow'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '98'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '567ad4f0-81d9-9f99-9b71-8e337e3f60b7'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '27f6402afd05cf1c0263d3ae2c2700bf',
    spanID: 'a071db9fc0e4fd95',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622375114315,
    duration: 9745,
    tags: [
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Moscow'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '84'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '567ad4f0-81d9-9f99-9b71-8e337e3f60b7'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '27f6402afd05cf1c0263d3ae2c2700bf',
    spanID: 'bbecb0c6cd75e952',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622375114514,
    duration: 10942,
    tags: [
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '567ad4f0-81d9-9f99-9b71-8e337e3f60b7'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't3'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Moscow'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '89'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'a7155241640607a0cdeb9bba2b9f799d',
    spanID: '5d728e016e169d51',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622851477718,
    duration: 10956,
    tags: [
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '38728ae4-0627-9d76-87f2-2ab3de886600'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'a7155241640607a0cdeb9bba2b9f799d',
    spanID: '3413dbe4aa8a0511',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622851478867,
    duration: 8724,
    tags: [
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '38728ae4-0627-9d76-87f2-2ab3de886600'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '690ec9fe428755b3295e5bc37afd1fed',
    spanID: '6e5405e51adfe487',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622834627276,
    duration: 6941,
    tags: [
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '900891f9-0e23-97c5-a305-8328cf82c3e0'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '690ec9fe428755b3295e5bc37afd1fed',
    spanID: '53a4a2b9f245dea1',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622834628247,
    duration: 5411,
    tags: [
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '900891f9-0e23-97c5-a305-8328cf82c3e0'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'ea330f614360b516934ca192d8ec9b70',
    spanID: 'daf77c805d1677ff',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622791225360,
    duration: 6680,
    tags: [
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'dd28fb9f-5e9d-9392-975f-694c08a92046'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'ea330f614360b516934ca192d8ec9b70',
    spanID: 'b2268ecd75955c81',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622791225886,
    duration: 5647,
    tags: [
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'dd28fb9f-5e9d-9392-975f-694c08a92046'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: 'cfb2a6ab9d813429c148c06004240d88',
    spanID: '5908ff2433dab67a',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622548306784,
    duration: 13420,
    tags: [
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '55cf02c6-b565-9b98-9c01-bec887479b6c'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '450'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Tirana'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.23'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'cfb2a6ab9d813429c148c06004240d88',
    spanID: '45d4e5693085d401',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622548307511,
    duration: 10334,
    tags: [
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '55cf02c6-b565-9b98-9c01-bec887479b6c'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Tirana'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '94'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'cfb2a6ab9d813429c148c06004240d88',
    spanID: '5981ffe360cec678',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622548307511,
    duration: 12299,
    tags: [
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Tirana'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '55cf02c6-b565-9b98-9c01-bec887479b6c'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '92'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: 'cfb2a6ab9d813429c148c06004240d88',
    spanID: 'f9dfe44dfa225ac1',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622548307661,
    duration: 11384,
    tags: [
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '131'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '55cf02c6-b565-9b98-9c01-bec887479b6c'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Tirana'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'viaggi.it'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '743addc7e132e0f42e7609241107bef3',
    spanID: '895c2f5896f3acb9',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622413741152,
    duration: 5248,
    tags: [
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '0e61cda8-c7e1-9c95-ae18-c704fb15446f'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '743addc7e132e0f42e7609241107bef3',
    spanID: '16e25e3886ef0667',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622413741761,
    duration: 4165,
    tags: [
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '0e61cda8-c7e1-9c95-ae18-c704fb15446f'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '3ab9de61ea26973979bb978733651ce4',
    spanID: '6e48045aaf92a68f',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622361951963,
    duration: 5418,
    tags: [
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '6f82760c-bcc9-9709-8f3f-096d0fdad8b0'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '3ab9de61ea26973979bb978733651ce4',
    spanID: '552d2539891fc93e',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622361952405,
    duration: 4411,
    tags: [
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '2286'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '6f82760c-bcc9-9709-8f3f-096d0fdad8b0'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 4
  },
  {
    traceID: '8ea3c2ac91f515e78a5591eb8f811268',
    spanID: 'f60bf6c5f1297296',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622354435236,
    duration: 14315,
    tags: [
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Tallinn'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '535'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '98516444-1b14-938d-af56-d2aa2de95156'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '8ea3c2ac91f515e78a5591eb8f811268',
    spanID: '8daf1e050fab4aa9',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622354435881,
    duration: 13373,
    tags: [
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Tallinn'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '98516444-1b14-938d-af56-d2aa2de95156'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '91'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '8ea3c2ac91f515e78a5591eb8f811268',
    spanID: '58226c0a19fc8581',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622354436016,
    duration: 13100,
    tags: [
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '98516444-1b14-938d-af56-d2aa2de95156'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '140'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Tallinn'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '8ea3c2ac91f515e78a5591eb8f811268',
    spanID: 'c2a126fec77147d',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622354436064,
    duration: 11806,
    tags: [
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '93'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Tallinn'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '98516444-1b14-938d-af56-d2aa2de95156'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '8ea3c2ac91f515e78a5591eb8f811268',
    spanID: 'f716e4d709d97516',
    operationName: 'cars.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622354436103,
    duration: 11040,
    tags: [
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||cars.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://cars.travel-agency:8000/cars/Tallinn'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: '98516444-1b14-938d-af56-d2aa2de95156'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '82'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 18
  },
  {
    traceID: '758df05f862bb29c6f867aeb4b9da596',
    spanID: '2e17738e403a07c1',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622888558328,
    duration: 9562,
    tags: [
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.24'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Nicosia'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f8a6a316-f1e9-9ac5-b2f9-5c6e92bed2cb'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '444'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '758df05f862bb29c6f867aeb4b9da596',
    spanID: 'afea2ada3a1f4fd2',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622888558835,
    duration: 8346,
    tags: [
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Nicosia'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '89'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f8a6a316-f1e9-9ac5-b2f9-5c6e92bed2cb'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '758df05f862bb29c6f867aeb4b9da596',
    spanID: 'edd51297d5498af0',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622888559035,
    duration: 8381,
    tags: [
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '128'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f8a6a316-f1e9-9ac5-b2f9-5c6e92bed2cb'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Nicosia'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '758df05f862bb29c6f867aeb4b9da596',
    spanID: '14bb6c202d1df3ac',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622888559180,
    duration: 8384,
    tags: [
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'f8a6a316-f1e9-9ac5-b2f9-5c6e92bed2cb'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'mobile'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Nicosia'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'registered'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'travels.uk'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '93'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '2d7854b690d2661924d4d119b5dbf098',
    spanID: '8bf00989ffbe3325',
    operationName: 'travels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622859026875,
    duration: 9148,
    tags: [
      {
        key: 'http.url',
        type: 'string',
        value: 'http://travels.travel-agency:8000/travels/Andorra'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'b7da0dee-9880-9b73-bb9f-8d1e4270f5c7'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '444'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'inbound|8000||'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.22'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'server'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '2d7854b690d2661924d4d119b5dbf098',
    spanID: 'e66e4d19e28858b1',
    operationName: 'insurances.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622859027341,
    duration: 8193,
    tags: [
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||insurances.travel-agency.svc.cluster.local'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '92'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://insurances.travel-agency:8000/insurances/Andorra'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'b7da0dee-9880-9b73-bb9f-8d1e4270f5c7'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '2d7854b690d2661924d4d119b5dbf098',
    spanID: '2ae408dc815a671',
    operationName: 'hotels.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622859027430,
    duration: 7395,
    tags: [
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://hotels.travel-agency:8000/hotels/Andorra'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'b7da0dee-9880-9b73-bb9f-8d1e4270f5c7'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '92'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||hotels.travel-agency.svc.cluster.local'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  },
  {
    traceID: '2d7854b690d2661924d4d119b5dbf098',
    spanID: 'b166d5fdc7c89126',
    operationName: 'flights.travel-agency.svc.cluster.local:8000/*',
    startTime: 1622622859027487,
    duration: 8260,
    tags: [
      {
        key: 'istio.canonical_revision',
        type: 'string',
        value: 'v1'
      },
      {
        key: 'http.header.portal',
        type: 'string',
        value: 'voyages.fr'
      },
      {
        key: 'guid:x-request-id',
        type: 'string',
        value: 'b7da0dee-9880-9b73-bb9f-8d1e4270f5c7'
      },
      {
        key: 'http.status_code',
        type: 'string',
        value: '200'
      },
      {
        key: 'istio.canonical_service',
        type: 'string',
        value: 'travels'
      },
      {
        key: 'istio.namespace',
        type: 'string',
        value: 'travel-agency'
      },
      {
        key: 'istio.mesh_id',
        type: 'string',
        value: 'cluster.local'
      },
      {
        key: 'upstream_cluster',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'component',
        type: 'string',
        value: 'proxy'
      },
      {
        key: 'http.method',
        type: 'string',
        value: 'GET'
      },
      {
        key: 'request_size',
        type: 'string',
        value: '0'
      },
      {
        key: 'http.header.device',
        type: 'string',
        value: 'web'
      },
      {
        key: 'user_agent',
        type: 'string',
        value: 'Go-http-client/1.1'
      },
      {
        key: 'http.url',
        type: 'string',
        value: 'http://flights.travel-agency:8000/flights/Andorra'
      },
      {
        key: 'response_size',
        type: 'string',
        value: '126'
      },
      {
        key: 'http.header.user',
        type: 'string',
        value: 'new'
      },
      {
        key: 'http.protocol',
        type: 'string',
        value: 'HTTP/1.1'
      },
      {
        key: 'node_id',
        type: 'string',
        value: 'sidecar~172.17.0.21~travels-v1-c49b8dc75-r4nqr.travel-agency~travel-agency.svc.cluster.local'
      },
      {
        key: 'response_flags',
        type: 'string',
        value: '-'
      },
      {
        key: 'http.header.travel',
        type: 'string',
        value: 't2'
      },
      {
        key: 'upstream_cluster.name',
        type: 'string',
        value: 'outbound|8000||flights.travel-agency.svc.cluster.local'
      },
      {
        key: 'peer.address',
        type: 'string',
        value: '172.17.0.21'
      },
      {
        key: 'downstream_cluster',
        type: 'string',
        value: '-'
      },
      {
        key: 'span.kind',
        type: 'string',
        value: 'client'
      },
      {
        key: 'internal.span.format',
        type: 'string',
        value: 'zipkin'
      }
    ],
    traceSize: 14
  }
];

export const dashboardServiceSpans = buildOverlay(spans);

export const dashboardService: DashboardModel = {
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
            [1622622510, 0.267],
            [1622622540, 0.267],
            [1622622570, 0.267],
            [1622622600, 0.267],
            [1622622630, 0.267],
            [1622622660, 0.267],
            [1622622690, 0.267],
            [1622622720, 0.267],
            [1622622750, 0.267],
            [1622622780, 0.267],
            [1622622810, 0.267],
            [1622622840, 0.267],
            [1622622870, 0.267],
            [1622622900, 0.267],
            [1622622930, 0.267],
            [1622622960, 0.267],
            [1622622990, 0.267],
            [1622623020, 0.267],
            [1622623050, 0.267],
            [1622623080, 0.267],
            [1622623110, 0.267]
          ],
          name: 'request_count'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622622510, 0.267],
            [1622622540, 0.267],
            [1622622570, 0.267],
            [1622622600, 0.267],
            [1622622630, 0.267],
            [1622622660, 0.267],
            [1622622690, 0.267],
            [1622622720, 0.267],
            [1622622750, 0.267],
            [1622622780, 0.267],
            [1622622810, 0.267],
            [1622622840, 0.267],
            [1622622870, 0.267],
            [1622622900, 0.267],
            [1622622930, 0.267],
            [1622622960, 0.267],
            [1622622990, 0.267],
            [1622623020, 0.267],
            [1622623050, 0.267],
            [1622623080, 0.267],
            [1622623110, 0.267]
          ],
          name: 'request_count'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622622510, 0.267],
            [1622622540, 0.267],
            [1622622570, 0.267],
            [1622622600, 0.267],
            [1622622630, 0.267],
            [1622622660, 0.267],
            [1622622690, 0.267],
            [1622622720, 0.267],
            [1622622750, 0.267],
            [1622622780, 0.267],
            [1622622810, 0.267],
            [1622622840, 0.267],
            [1622622870, 0.267],
            [1622622900, 0.267],
            [1622622930, 0.267],
            [1622622960, 0.267],
            [1622622990, 0.267],
            [1622623020, 0.267],
            [1622623050, 0.267],
            [1622623080, 0.267],
            [1622623110, 0.267]
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
            [1622622510, 0.009913],
            [1622622540, 0.012275000000000001],
            [1622622570, 0.011163000000000001],
            [1622622600, 0.013387000000000001],
            [1622622630, 0.008525000000000001],
            [1622622660, 0.02525],
            [1622622690, 0.016137000000000002],
            [1622622720, 0.012025000000000001],
            [1622622750, 0.016137000000000002],
            [1622622780, 0.012887000000000001],
            [1622622810, 0.008275000000000001],
            [1622622840, 0.008275000000000001],
            [1622622870, 0.021275],
            [1622622900, 0.024387000000000002],
            [1622622930, 0.021525],
            [1622622960, 0.018887],
            [1622622990, 0.009525],
            [1622623020, 0.016524999999999998],
            [1622623050, 0.0175],
            [1622623080, 0.021775],
            [1622623110, 0.018888000000000002]
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
            [1622622510, 0.010275000000000001],
            [1622622540, 0.009525],
            [1622622570, 0.012025000000000001],
            [1622622600, 0.012775],
            [1622622630, 0.014275000000000001],
            [1622622660, 0.009913],
            [1622622690, 0.011888000000000001],
            [1622622720, 0.014775],
            [1622622750, 0.012025000000000001],
            [1622622780, 0.009025],
            [1622622810, 0.011275],
            [1622622840, 0.008275000000000001],
            [1622622870, 0.017387],
            [1622622900, 0.008913],
            [1622622930, 0.010525000000000001],
            [1622622960, 0.015388],
            [1622622990, 0.014],
            [1622623020, 0.007913],
            [1622623050, 0.013775],
            [1622623080, 0.015387000000000001],
            [1622623110, 0.010275000000000001]
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
            [1622622510, 0.008775],
            [1622622540, 0.009775],
            [1622622570, 0.014887000000000001],
            [1622622600, 0.009275],
            [1622622630, 0.02475],
            [1622622660, 0.0135],
            [1622622690, 0.010163],
            [1622622720, 0.009775],
            [1622622750, 0.012138],
            [1622622780, 0.015138],
            [1622622810, 0.011025],
            [1622622840, 0.011637000000000002],
            [1622622870, 0.0175],
            [1622622900, 0.009913],
            [1622622930, 0.009775],
            [1622622960, 0.016274999999999998],
            [1622622990, 0.016138000000000003],
            [1622623020, 0.015137000000000001],
            [1622623050, 0.016387000000000002],
            [1622623080, 0.012525000000000001],
            [1622623110, 0.014638]
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
            [1622622510, 1248],
            [1622622540, 1248],
            [1622622570, 1248],
            [1622622600, 1248],
            [1622622630, 1248],
            [1622622660, 1248],
            [1622622690, 1248],
            [1622622720, 1248],
            [1622622750, 1248],
            [1622622780, 1248],
            [1622622810, 1248],
            [1622622840, 1248],
            [1622622870, 1248],
            [1622622900, 1248],
            [1622622930, 1248],
            [1622622960, 1248],
            [1622622990, 1248],
            [1622623020, 1248],
            [1622623050, 1248],
            [1622623080, 1248],
            [1622623110, 1248]
          ],
          name: 'request_throughput'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622622510, 1248],
            [1622622540, 1248],
            [1622622570, 1248],
            [1622622600, 1248],
            [1622622630, 1248],
            [1622622660, 1248],
            [1622622690, 1248],
            [1622622720, 1248],
            [1622622750, 1248],
            [1622622780, 1248],
            [1622622810, 1248],
            [1622622840, 1248],
            [1622622870, 1248],
            [1622622900, 1248],
            [1622622930, 1248],
            [1622622960, 1248],
            [1622622990, 1248],
            [1622623020, 1248],
            [1622623050, 1248],
            [1622623080, 1248],
            [1622623110, 1248]
          ],
          name: 'request_throughput'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622622510, 1248],
            [1622622540, 1253.336],
            [1622622570, 1248],
            [1622622600, 1248],
            [1622622630, 1248],
            [1622622660, 936],
            [1622622690, 1248],
            [1622622720, 1248],
            [1622622750, 1248],
            [1622622780, 1248],
            [1622622810, 1248],
            [1622622840, 1248],
            [1622622870, 1248],
            [1622622900, 1248],
            [1622622930, 1248],
            [1622622960, 1248],
            [1622622990, 1248],
            [1622623020, 1248],
            [1622623050, 1248],
            [1622623080, 1248],
            [1622623110, 1248]
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
            [1622622510, 585],
            [1622622540, 585],
            [1622622570, 585],
            [1622622600, 585],
            [1622622630, 585],
            [1622622660, 585],
            [1622622690, 585],
            [1622622720, 585],
            [1622622750, 585],
            [1622622780, 585],
            [1622622810, 585],
            [1622622840, 585],
            [1622622870, 585],
            [1622622900, 585],
            [1622622930, 585],
            [1622622960, 585],
            [1622622990, 585],
            [1622623020, 585],
            [1622623050, 585],
            [1622623080, 585],
            [1622623110, 585]
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
            [1622622510, 585],
            [1622622540, 585],
            [1622622570, 585],
            [1622622600, 585],
            [1622622630, 585],
            [1622622660, 585],
            [1622622690, 585],
            [1622622720, 585],
            [1622622750, 585],
            [1622622780, 585],
            [1622622810, 585],
            [1622622840, 585],
            [1622622870, 585],
            [1622622900, 585],
            [1622622930, 585],
            [1622622960, 585],
            [1622622990, 585],
            [1622623020, 585],
            [1622623050, 585],
            [1622623080, 585],
            [1622623110, 585]
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
            [1622622510, 585],
            [1622622540, 587.5],
            [1622622570, 585],
            [1622622600, 585],
            [1622622630, 585],
            [1622622660, 585],
            [1622622690, 585],
            [1622622720, 585],
            [1622622750, 585],
            [1622622780, 585],
            [1622622810, 585],
            [1622622840, 585],
            [1622622870, 585],
            [1622622900, 585],
            [1622622930, 585],
            [1622622960, 585],
            [1622622990, 585],
            [1622623020, 585],
            [1622623050, 585],
            [1622623080, 585],
            [1622623110, 585]
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
            [1622622510, 5066.664],
            [1622622540, 5066.664],
            [1622622570, 5013.336],
            [1622622600, 5066.664],
            [1622622630, 5066.664],
            [1622622660, 5013.336],
            [1622622690, 5066.664],
            [1622622720, 5066.664],
            [1622622750, 5013.336],
            [1622622780, 5066.664],
            [1622622810, 5066.664],
            [1622622840, 5013.336],
            [1622622870, 5013.336],
            [1622622900, 5066.664],
            [1622622930, 5066.664],
            [1622622960, 5013.336],
            [1622622990, 5066.664],
            [1622623020, 5066.664],
            [1622623050, 5013.336],
            [1622623080, 5066.664],
            [1622623110, 5066.664]
          ],
          name: 'response_throughput'
        },
        {
          labels: {
            source_canonical_service: 'viaggi',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622622510, 5066.664],
            [1622622540, 5066.664],
            [1622622570, 5013.336],
            [1622622600, 5066.664],
            [1622622630, 5066.664],
            [1622622660, 5013.336],
            [1622622690, 5066.664],
            [1622622720, 5066.664],
            [1622622750, 5013.336],
            [1622622780, 5066.664],
            [1622622810, 5066.664],
            [1622622840, 5013.336],
            [1622622870, 5066.664],
            [1622622900, 5066.664],
            [1622622930, 5013.336],
            [1622622960, 5066.664],
            [1622622990, 5066.664],
            [1622623020, 5013.336],
            [1622623050, 5066.664],
            [1622623080, 5066.664],
            [1622623110, 5066.664]
          ],
          name: 'response_throughput'
        },
        {
          labels: {
            source_canonical_service: 'voyages',
            source_workload_namespace: 'travel-portal'
          },
          datapoints: [
            [1622622510, 5066.664],
            [1622622540, 5013.336],
            [1622622570, 5066.664],
            [1622622600, 5066.664],
            [1622622630, 5013.336],
            [1622622660, 4240],
            [1622622690, 5066.664],
            [1622622720, 5066.664],
            [1622622750, 5013.336],
            [1622622780, 5066.664],
            [1622622810, 5066.664],
            [1622622840, 5013.336],
            [1622622870, 5066.664],
            [1622622900, 5066.664],
            [1622622930, 5013.336],
            [1622622960, 5066.664],
            [1622622990, 5066.664],
            [1622623020, 5013.336],
            [1622623050, 5066.664],
            [1622623080, 5066.664],
            [1622623110, 5013.336]
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
            [1622622510, 2375],
            [1622622540, 2375],
            [1622622570, 2350],
            [1622622600, 2375],
            [1622622630, 2375],
            [1622622660, 2350],
            [1622622690, 2375],
            [1622622720, 2375],
            [1622622750, 2350],
            [1622622780, 2375],
            [1622622810, 2375],
            [1622622840, 2350],
            [1622622870, 2350],
            [1622622900, 2375],
            [1622622930, 2375],
            [1622622960, 2350],
            [1622622990, 2375],
            [1622623020, 2375],
            [1622623050, 2350],
            [1622623080, 2375],
            [1622623110, 2375]
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
            [1622622510, 2375],
            [1622622540, 2375],
            [1622622570, 2350],
            [1622622600, 2375],
            [1622622630, 2375],
            [1622622660, 2350],
            [1622622690, 2375],
            [1622622720, 2375],
            [1622622750, 2350],
            [1622622780, 2375],
            [1622622810, 2375],
            [1622622840, 2350],
            [1622622870, 2375],
            [1622622900, 2375],
            [1622622930, 2350],
            [1622622960, 2375],
            [1622622990, 2375],
            [1622623020, 2350],
            [1622623050, 2375],
            [1622623080, 2375],
            [1622623110, 2375]
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
            [1622622510, 2375],
            [1622622540, 2350],
            [1622622570, 2375],
            [1622622600, 2375],
            [1622622630, 2350],
            [1622622660, 2650],
            [1622622690, 2375],
            [1622622720, 2375],
            [1622622750, 2350],
            [1622622780, 2375],
            [1622622810, 2375],
            [1622622840, 2350],
            [1622622870, 2375],
            [1622622900, 2375],
            [1622622930, 2350],
            [1622622960, 2375],
            [1622622990, 2375],
            [1622623020, 2350],
            [1622623050, 2375],
            [1622623080, 2375],
            [1622623110, 2350]
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
  externalLinks: [],
  rows: 2
};
