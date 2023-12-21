// The Envoy response flags can be found here (search for %RESPONSE_FLAGS% on the page):
// https://www.envoyproxy.io/docs/envoy/latest/configuration/observability/access_log/usage
export const responseFlags = {
  DC: {
    code: '500',
    help: $t('responseFlags.DC.help', 'Downstream connection termination'),
    short: $t('responseFlags.DC.short', 'Downstream cx term')
  },
  DI: { help: $t('responseFlags.DI.help', 'Delayed via fault injection') },
  DPE: {
    help: $t('responseFlags.DPE.help', 'Downstream request had an HTTP protocol error (is port type correct?)'),
    short: $t('responseFlags.DPE.short', 'Downstream invalid HTTP')
  },
  FI: { help: $t('responseFlags.FI.help', 'Aborted via fault injection') },
  IH: {
    code: '400',
    help: $t('responseFlags.IH.help', 'Invalid value for a strictly-checked header'),
    short: $t('responseFlags.IH.short', 'Invalid header value')
  },
  LH: {
    code: '503',
    help: $t('responseFlags.LH.help', 'Local service failed health check request'),
    short: $t('responseFlags.LH.short', 'Failed health check')
  },
  LR: { code: '503', help: $t('responseFlags.LR.help', 'Connection local reset') },
  NR: {
    code: '404',
    help: $t('responseFlags.NR.help', 'No route configured (check DestinationRule or VirtualService)'),
    short: $t('responseFlags.NR.short', 'No route')
  },
  RL: {
    code: '429',
    help: $t('responseFlags.RL.help', 'Ratelimited locally by the HTTP rate limit filter'),
    short: $t('responseFlags.RL.short', 'Rate limit')
  },
  RLSE: { help: $t('responseFlags.RLSE.help', 'Rate limited service error') },
  SI: { code: '408', help: $t('responseFlags.SI.help', 'Stream idle timeout') },
  UAEX: { help: $t('responseFlags.UAEX.help', 'Unauthorized external service') },
  UC: {
    code: '503',
    help: $t('responseFlags.UC.help', 'Stream idle timeout'),
    short: $t('responseFlags.UC.short', 'Upstream cx term')
  },
  UF: {
    code: '503',
    help: $t('responseFlags.UF.help', 'Upstream connection failure (check for mutual TLS configuration conflict'),
    short: $t('responseFlags.UF.short', 'Upstream cx failure')
  },
  UH: {
    code: '503',
    help: $t('responseFlags.UH.help', 'No healthy upstream hosts in upstream cluster'),
    short: $t('responseFlags.UH.short', 'No healthy upstream')
  },
  UMSDR: { help: $t('responseFlags.UMSDR.help', 'Upstream request reached max stream duration') },
  UO: {
    code: '503',
    help: $t('responseFlags.UO.help', 'Upstream overflow (circuit breaker open)'),
    short: $t('responseFlags.UO.short', 'Circuit breaker open')
  },
  UR: { code: '503', help: $t('responseFlags.UR.help', 'Upstream remote reset') },
  URX: {
    code: '503',
    help: $t('responseFlags.URX.help', 'Upstream retry limit (HTTP) or Max connect attempts (TCP) exceeded'),
    short: $t('responseFlags.URX.short', 'Upstream retry/connect limit')
  },
  UT: { code: '504', help: $t('responseFlags.UT.help', 'Upstream request timeout') }
};
