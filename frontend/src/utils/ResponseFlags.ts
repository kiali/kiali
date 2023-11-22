// The Envoy response flags can be found here (search for %RESPONSE_FLAGS% on the page):
// https://www.envoyproxy.io/docs/envoy/latest/configuration/observability/access_log/usage
export const responseFlags = {
  DC: {
    code: '500',
    help: $t('tip132', 'Downstream connection termination'),
    short: $t('tip133', 'Downstream cx term')
  },
  DI: { help: $t('tip134', 'Delayed via fault injection') },
  DPE: {
    help: $t('tip135', 'Downstream request had an HTTP protocol error (is port type correct?)'),
    short: $t('tip136', 'Downstream invalid HTTP')
  },
  FI: { help: $t('tip137', 'Aborted via fault injection') },
  IH: {
    code: '400',
    help: $t('tip138', 'Invalid value for a strictly-checked header'),
    short: $t('tip139', 'Invalid header value')
  },
  LH: {
    code: '503',
    help: $t('tip140', 'Local service failed health check request'),
    short: $t('FailedHealthCheck', 'Failed health check')
  },
  LR: { code: '503', help: $t('ConnectionLocalReset', 'Connection local reset') },
  NR: {
    code: '404',
    help: $t('tip141', 'No route configured (check DestinationRule or VirtualService)'),
    short: $t('NoRoute', 'No route')
  },
  RL: {
    code: '429',
    help: $t('tip142', 'Ratelimited locally by the HTTP rate limit filter'),
    short: $t('RateLimit', 'Rate limit')
  },
  RLSE: { help: $t('tip143', 'Rate limited service error') },
  SI: { code: '408', help: $t('StreamIdleTimeout', 'Stream idle timeout') },
  UAEX: { help: $t('UnauthorizedExternalService', 'Unauthorized external service') },
  UC: {
    code: '503',
    help: $t('StreamIdleTimeout', 'Stream idle timeout'),
    short: $t('tip145', 'Upstream cx term')
  },
  UF: {
    code: '503',
    help: $t('tip146', 'Upstream connection failure (check for mutual TLS configuration conflict'),
    short: $t('tip147', 'Upstream cx failure')
  },
  UH: {
    code: '503',
    help: $t('tip148', 'No healthy upstream hosts in upstream cluster'),
    short: $t('tip296', 'No healthy upstream')
  },
  UMSDR: { help: $t('tip149', 'Upstream request reached max stream duration') },
  UO: {
    code: '503',
    help: $t('tip150', 'Upstream overflow (circuit breaker open)'),
    short: $t('tip295', 'Circuit breaker open')
  },
  UR: { code: '503', help: $t('UpstreamRemoteReset', 'Upstream remote reset') },
  URX: {
    code: '503',
    help: $t('tip151', 'Upstream retry limit (HTTP) or Max connect attempts (TCP) exceeded'),
    short: $t('tip152', 'Upstream retry/connect limit')
  },
  UT: { code: '504', help: $t('UpstreamRequestTimeout', 'Upstream request timeout') }
};
