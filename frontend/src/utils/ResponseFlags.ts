// The Envoy response flags can be found here (search for %RESPONSE_FLAGS% on the page):
// https://www.envoyproxy.io/docs/envoy/latest/configuration/observability/access_log/usage
export const responseFlags = {
  DC: { code: '500', help: 'tip132', short: 'tip133' },
  DI: { help: 'tip134' },
  DPE: {
    help: 'tip135',
    short: 'tip136'
  },
  FI: { help: 'tip137' },
  IH: { code: '400', help: 'tip138', short: 'tip139' },
  LH: { code: '503', help: 'tip140', short: 'FailedHealthCheck' },
  LR: { code: '503', help: 'ConnectionLocalReset' },
  NR: { code: '404', help: 'tip141', short: 'NoRoute' },
  RL: { code: '429', help: 'tip142', short: 'RateLimit' },
  RLSE: { help: 'tip143' },
  SI: { code: '408', help: 'StreamIdleTimeout' },
  UAEX: { help: 'UnauthorizedExternalService' },
  UC: { code: '503', help: 'StreamIdleTimeout', short: 'tip145' },
  UF: {
    code: '503',
    help: 'tip146',
    short: 'tip147'
  },
  UH: { code: '503', help: 'tip148', short: 'tip296' },
  UMSDR: { help: 'tip149' },
  UO: { code: '503', help: 'tip150', short: 'tip295' },
  UR: { code: '503', help: 'UpstreamRemoteReset' },
  URX: {
    code: '503',
    help: 'tip151',
    short: 'tip152'
  },
  UT: { code: '504', help: 'ream request timeo' }
};
