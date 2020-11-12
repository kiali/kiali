import logfmtParser from 'logfmt/lib/logfmt_parser';
import { KeyValuePair, Span } from '../../types/JaegerInfo';
import { retrieveTimeRange } from 'components/Time/TimeRangeHelper';
import { guardTimeRange, durationToBounds } from 'types/Common';
import { Target } from 'types/MetricsOptions';

export const buildTags = (showErrors: boolean, statusCode: string): string => {
  let tags = '';
  if (showErrors) {
    tags += 'error=true';
  }
  if (statusCode !== 'none') {
    tags += ' http.status_code=' + statusCode;
  }
  return convTagsLogfmt(tags);
};

export const isErrorTag = ({ key, value }: KeyValuePair) => key === 'error' && (value === true || value === 'true');

const convTagsLogfmt = (tags: string) => {
  if (!tags) {
    return '';
  }
  const data = logfmtParser.parse(tags);
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (typeof value !== 'string') {
      data[key] = String(value);
    }
  });
  return JSON.stringify(data);
};

export const getTimeRangeMicros = () => {
  const range = retrieveTimeRange() || 600;
  // Convert any time range (like duration) to bounded from/to
  const boundsMillis = guardTimeRange(range, durationToBounds, b => b);
  // Convert to microseconds
  return {
    from: boundsMillis.from * 1000,
    to: boundsMillis.to ? boundsMillis.to * 1000 : undefined
  };
};

type WorkloadAndNamespace = { pod: string; workload: string; namespace: string };
export const getWorkloadFromSpan = (span: Span): WorkloadAndNamespace | undefined => {
  const nodeKV = span.tags.find(tag => tag.key === 'node_id');
  if (nodeKV) {
    // Example of node value:
    // sidecar~172.17.0.20~ai-locals-6d8996bff-ztg6z.default~default.svc.cluster.local
    const parts = nodeKV.value.split('~');
    if (parts.length < 3) {
      return undefined;
    }
    const podWithNamespace = parts[2];
    const nsIdx = podWithNamespace.lastIndexOf('.');
    if (nsIdx >= 0) {
      return extractWorkloadFromPod(podWithNamespace.substring(0, nsIdx), podWithNamespace.substring(nsIdx + 1));
    }
    return undefined;
  }
  // Tag not found => try with 'hostname' in process' tags
  const hostnameKV = span.process.tags.find(tag => tag.key === 'hostname');
  if (hostnameKV) {
    const svcNs = span.process.serviceName.split('.');
    return extractWorkloadFromPod(hostnameKV.value, svcNs.length > 1 ? svcNs[1] : '');
  }
  return undefined;
};

const replicasetFromPodRegex = /^([a-z0-9-.]+)-[a-z0-9]+$/;
const extractWorkloadFromPod = (pod: string, ns: string): WorkloadAndNamespace | undefined => {
  const result = replicasetFromPodRegex.exec(pod);
  if (result && result.length === 2) {
    return {
      pod: pod,
      workload: adjustWorkloadNameFromReplicaset(result[1]),
      namespace: ns
    };
  }
  return undefined;
};

// Pod template hash should be made of alphanum without vowels, '0', '1' and '3'
// (see https://github.com/kubernetes/kubernetes/blob/release-1.17/staging/src/k8s.io/apimachinery/pkg/util/rand/rand.go#L83)
const templateHashRegex = /^[bcdfghjklmnpqrstvwxz2456789]{6,16}$/;
const adjustWorkloadNameFromReplicaset = (replicaset: string): string => {
  // This is a best effort to try to disambiguate deployment-like workloads versus replicaset-like workloads
  // Workloads can be:
  // - foo-fg65h9p7qj (deployment)
  // - bar-replicaset (replicaset)
  // In the first case, we want to keep "foo", but in the second case we need the whole "bar-replicaset" string.
  // This is not 100% guaranteed, there's still a small chance that a replica set is wrongly seen as a deployment-like workload.
  // That happens when:
  // - it contains at least one dash '-'
  // - AND the part after the last dash is:
  //   . between 6 and 16 characters long
  //   . AND compound exclusively of alphanums characters except vowels, '0', '1' and '3'
  const parts = replicaset.split('-');
  if (parts.length < 2) {
    return replicaset;
  }
  const templateHashCandidate = parts[parts.length - 1];
  if (templateHashRegex.test(templateHashCandidate)) {
    return replicaset.substring(0, replicaset.length - templateHashCandidate.length - 1);
  }
  return replicaset;
};

export const searchParentWorkload = (span: Span): WorkloadAndNamespace | undefined => {
  if (Array.isArray(span.references)) {
    const ref = span.references.find(s => s.refType === 'CHILD_OF' || s.refType === 'FOLLOWS_FROM');
    if (ref && ref.span) {
      return getWorkloadFromSpan(ref.span);
    }
  }
  return undefined;
};

type AppAndNamespace = { app: string; namespace: string };
export const getAppFromSpan = (span: Span): AppAndNamespace | undefined => {
  const split = span.process.serviceName.split('.');
  return { app: split[0], namespace: split.length > 1 ? split[1] : '' };
};

export const searchParentApp = (span: Span): AppAndNamespace | undefined => {
  if (Array.isArray(span.references)) {
    const ref = span.references.find(s => s.refType === 'CHILD_OF' || s.refType === 'FOLLOWS_FROM');
    if (ref && ref.span) {
      return getAppFromSpan(ref.span);
    }
  }
  return undefined;
};

export const getSpanType = (span: Span): 'envoy' | 'http' | 'tcp' | 'unknown' => {
  const component = span.tags.find(tag => tag.key === 'component');
  if (component?.value === 'proxy') {
    return 'envoy';
  }
  if (span.tags.some(t => t.key.startsWith('http.'))) {
    return 'http';
  }
  if (span.tags.some(t => t.key.startsWith('peer.'))) {
    return 'tcp';
  }
  return 'unknown';
};

export type OpenTracingBaseInfo = {
  component?: string;
  hasError: boolean;
};

export type OpenTracingHTTPInfo = OpenTracingBaseInfo & {
  statusCode?: number;
  url?: string;
  method?: string;
  direction?: 'inbound' | 'outbound';
};

export const extractOpenTracingBaseInfo = (span: Span): OpenTracingBaseInfo => {
  const info: OpenTracingBaseInfo = { hasError: false };
  span.tags.forEach(t => {
    if (t.key === 'component') {
      info.component = t.value;
    }
    if (isErrorTag(t)) {
      info.hasError = true;
    }
  });
  return info;
};

export const extractOpenTracingHTTPInfo = (span: Span): OpenTracingHTTPInfo => {
  // See https://github.com/opentracing/specification/blob/master/semantic_conventions.md
  const info: OpenTracingHTTPInfo = extractOpenTracingBaseInfo(span);
  span.tags.forEach(t => {
    if (t.key === 'http.status_code') {
      const val = parseInt(t.value, 10);
      if (!isNaN(val) && val > 0) {
        info.statusCode = val;
      }
    } else if (t.key === 'http.url') {
      info.url = t.value;
    } else if (t.key === 'http.method') {
      info.method = t.value;
    } else if (t.key === 'span.kind') {
      if (t.value === 'client') {
        info.direction = 'outbound';
      } else if (t.value === 'server') {
        info.direction = 'inbound';
      }
    }
  });
  return info;
};

export type OpenTracingTCPInfo = OpenTracingBaseInfo & {
  topic?: string;
  peerAddress?: string;
  peerHostname?: string;
  direction?: 'inbound' | 'outbound';
};

export const extractOpenTracingTCPInfo = (span: Span): OpenTracingTCPInfo => {
  // See https://github.com/opentracing/specification/blob/master/semantic_conventions.md
  const info: OpenTracingTCPInfo = extractOpenTracingBaseInfo(span);
  span.tags.forEach(t => {
    if (t.key === 'message_bus.destination') {
      info.topic = t.value;
    } else if (t.key === 'peer.address') {
      info.peerAddress = t.value;
    } else if (t.key === 'peer.hostname') {
      info.peerHostname = t.value;
    } else if (t.key === 'span.kind') {
      if (t.value === 'producer' || t.value === 'client') {
        info.direction = 'outbound';
      } else if (t.value === 'consumer' || t.value === 'server') {
        info.direction = 'inbound';
      }
    }
  });
  return info;
};

export type EnvoySpanInfo = OpenTracingHTTPInfo & {
  responseFlags?: string;
  peer?: Target;
};

export const extractEnvoySpanInfo = (span: Span): EnvoySpanInfo => {
  const info: EnvoySpanInfo = extractOpenTracingHTTPInfo(span);
  span.tags.forEach(t => {
    if (t.key === 'response_flags') {
      if (t.value !== '-') {
        info.responseFlags = t.value;
      }
    } else if (t.key === 'upstream_cluster') {
      const parts = (t.value as string).split('|');
      if (parts.length === 4) {
        if (parts[0] === 'outbound') {
          const svcParts = parts[3].split('.');
          if (svcParts.length === 5) {
            info.direction = 'outbound';
            info.peer = {
              name: svcParts[0],
              namespace: svcParts[1],
              kind: 'service'
            };
          }
        } else if (parts[0] === 'inbound') {
          const wkdNs = searchParentWorkload(span);
          if (wkdNs) {
            info.direction = 'inbound';
            info.peer = {
              name: wkdNs.workload,
              namespace: wkdNs.namespace,
              kind: 'workload'
            };
          }
        }
      }
    }
  });
  return info;
};

export const extractSpanInfo = (span: Span) => {
  const type = getSpanType(span);
  const info =
    type === 'envoy'
      ? extractEnvoySpanInfo(span)
      : type === 'http'
      ? extractOpenTracingHTTPInfo(span)
      : type === 'tcp'
      ? extractOpenTracingTCPInfo(span)
      : extractOpenTracingBaseInfo(span);
  return { type: type, info: info };
};
