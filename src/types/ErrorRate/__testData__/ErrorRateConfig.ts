import { getExpr } from '../../../config/HealthConfig';
import { RequestHealth, RequestType } from '../../Health';
import { HealthAnnotationType } from '../../HealthAnnotation';
import { TrafficItem } from '../../../components/TrafficList/TrafficDetails';
import { NodeType, Responses } from '../../Graph';

const codes = ['200', '400', '404', '500'];
export const annotationSample: HealthAnnotationType = { 'health.kiali.io/rate': '4XX,10,20,http,inbound' };

const precision = 100; // 2 decimals
const randomRequest = (greater: number = 40): RequestType => {
  var result = {
    http: {}
  };
  codes.forEach(code => {
    result['http'][code] =
      Math.floor(Math.random() * (100 * precision - greater * precision) + greater * precision) / (1 * precision);
  });
  return result;
};

export const generateTrafficItem = (
  requests: { [key: string]: number[] },
  annotation?: HealthAnnotationType
): TrafficItem => {
  var responses: Responses = {};

  Object.keys(requests).forEach(key => {
    var flags = {};
    requests[key].forEach((v, i) => (flags[i] = v));
    responses[key] = {
      hosts: {},
      flags
    };
  });

  return {
    direction: 'inbound',
    node: {
      id: 'x-server',
      type: NodeType.SERVICE,
      namespace: 'alpha',
      name: 'x-server',
      isInaccessible: false,
      healthAnnotation: annotation
    },
    traffic: {
      protocol: 'http',
      rates: {
        http: '20'
      },
      responses
    }
  };
};

export const generateRequestHealth = (
  annotation: HealthAnnotationType,
  inbound?: RequestType,
  outbound?: RequestType
): RequestHealth => {
  return {
    inbound: inbound || randomRequest(),
    outbound: outbound || randomRequest(),
    healthAnnotations: annotation || {}
  };
};

export const serverRateConfig = {
  clusters: {},
  kialiFeatureFlags: {
    istioInjectionAction: true,
    istioUpgradeAction: false
  },
  healthConfig: {
    rate: [
      {
        namespace: new RegExp('bookinfo'),
        kind: new RegExp('app'),
        name: new RegExp('reviews'),
        tolerance: [
          {
            code: new RegExp('4dd'),
            degraded: 20,
            failure: 30,
            protocol: new RegExp('http'),
            direction: new RegExp('inbound')
          }
        ]
      },
      {
        namespace: getExpr(''),
        kind: getExpr(''),
        name: getExpr(''),
        tolerance: [
          {
            code: new RegExp(/^5\d\d$/),
            protocol: new RegExp('http'),
            direction: new RegExp('.*'),
            degraded: 0.1,
            failure: 20
          },
          {
            code: new RegExp(/^[1-9]$|^1[0-6]$/),
            protocol: new RegExp('grpc'),
            direction: new RegExp('.*'),
            degraded: 0.1,
            failure: 20
          }
        ]
      }
    ]
  },
  installationTag: 'Kiali Console',
  istioAnnotations: {
    istioInjectionAnnotation: ''
  },
  istioCanaryRevision: {
    current: '',
    upgrade: ''
  },
  istioIdentityDomain: 'svc.cluster.local',
  istioNamespace: 'istio-system',
  istioLabels: {
    appLabelName: 'app',
    injectionLabelName: 'istio-injection',
    injectionLabelRev: 'istio.io/rev',
    versionLabelName: 'version'
  },
  prometheus: {
    globalScrapeInterval: 15,
    storageTsdbRetention: 21600
  },
  durations: {},
  istioTelemetryV2: true
};

export const tolerancesDefault = [
  {
    code: new RegExp(/^[4-5]\d\d$/),
    protocol: new RegExp('http'),
    direction: new RegExp('.*'),
    degraded: 0.1,
    failure: 20
  },
  {
    code: new RegExp(/^[1-9]$|^1[0-6]$/),
    protocol: new RegExp('grpc'),
    direction: new RegExp('.*'),
    degraded: 0.1,
    failure: 20
  }
];
