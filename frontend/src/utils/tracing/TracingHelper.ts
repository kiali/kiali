import _round from 'lodash/round';
import moment from 'moment';
import {
  EnvoySpanInfo,
  JaegerTrace,
  KeyValuePair,
  OpenTracingBaseInfo,
  OpenTracingHTTPInfo,
  OpenTracingTCPInfo,
  Span
} from 'types/TracingInfo';
import { retrieveTimeRange } from 'components/Time/TimeRangeHelper';
import { guardTimeRange, durationToBounds, DurationInSeconds } from 'types/Common';
import { spansSort } from './TraceTransform';

export const defaultTracingDuration: DurationInSeconds = 600;

export const isErrorTag = ({ key, value }: KeyValuePair): boolean =>
  key === 'error' && (value === true || value === 'true');

export const getTimeRangeMicros = (): { from: number; to: number | undefined } => {
  const range = retrieveTimeRange();
  // Convert any time range (like duration) to bounded from/to
  const boundsMillis = guardTimeRange(range, durationToBounds, b => b);
  // Not necessary, we know that guardTimeRange will always send a default
  const defaultFrom = new Date().getTime() - defaultTracingDuration * 1000;
  // Convert to microseconds
  return {
    from: boundsMillis.from ? boundsMillis.from * 1000 : defaultFrom * 1000,
    to: boundsMillis.to ? boundsMillis.to * 1000 : undefined
  };
};

type WorkloadAndNamespace = {
  namespace: string;
  pod: string;
  workload: string;
};

const tagValue = (span: Span, key: string): string | undefined => {
  const t = span.tags.find(tag => tag.key === key);
  const v = t?.value;
  if (v === undefined || v === null || String(v).trim() === '') {
    return undefined;
  }
  return String(v);
};

/**
 * Checks if a span originates from an Istio Ambient waypoint proxy.
 *
 * Istio Ambient waypoint spans use node_id format: "waypoint~{ip}~{pod.namespace}~{domain}"
 * where the first segment is the proxy role, not the Kubernetes workload name.
 *
 * @param span - The span to check
 * @returns true if the span is from a waypoint proxy, false otherwise
 */
export const isWaypointProxySpan = (span: Span): boolean => {
  const nodeKV = span.tags.find(tag => tag.key === 'node_id');
  const v = nodeKV?.value;
  return typeof v === 'string' && v.startsWith('waypoint~');
};

/**
 * Extracts workload information from Istio Ambient waypoint span tags.
 *
 * For waypoint spans:
 * - source_* tags represent the caller workload
 * - destination_* tags represent the workload handling the request
 *
 * @param span - The waypoint span
 * @param end - Which end of the connection to extract ('source' or 'destination')
 * @returns Workload info with namespace, workload name, and pod name, or undefined if insufficient data
 */
const ambientWorkloadFromTags = (span: Span, end: 'source' | 'destination'): WorkloadAndNamespace | undefined => {
  const prefix = end === 'source' ? 'istio.source' : 'istio.destination';
  const pod = tagValue(span, `${prefix}_instance_name`);
  const workload = tagValue(span, `${prefix}_workload`);
  const ns = tagValue(span, `${prefix}_namespace`);
  // Only return if we have at least workload and namespace (minimum useful info)
  if (workload && ns) {
    return {
      namespace: ns,
      pod: pod || '',
      workload: workload
    };
  }
  return undefined;
};

const ambientWorkloadFromSpan = (span: Span): WorkloadAndNamespace | undefined => {
  const kind = tagValue(span, 'span.kind');
  if (kind === 'server' || kind === 'consumer') {
    return ambientWorkloadFromTags(span, 'destination');
  }
  if (kind === 'client' || kind === 'producer') {
    return ambientWorkloadFromTags(span, 'source');
  }
  // No span.kind or unrecognized kind: try destination first, then source
  if (tagValue(span, 'istio.destination_workload')) {
    return ambientWorkloadFromTags(span, 'destination');
  }
  const sourceResult = ambientWorkloadFromTags(span, 'source');
  if (sourceResult) {
    return sourceResult;
  }
  // Try destination as final fallback
  return ambientWorkloadFromTags(span, 'destination');
};

export const getWorkloadFromSpan = (span: Span): WorkloadAndNamespace | undefined => {
  if (isWaypointProxySpan(span)) {
    const fromTags = ambientWorkloadFromSpan(span);
    if (fromTags) {
      return fromTags;
    }
    // Older Istio waypoint traces may not include istio.source_/destination_ workload tags.
    // Fall back to legacy node_id/hostname parsing to avoid returning "unknown".
  }
  const nodeKV = span.tags.find(tag => tag.key === 'node_id');
  if (nodeKV) {
    // Example of node value:
    // sidecar~172.17.0.20~ai-locals-6d8996bff-ztg6z.default~default.svc.cluster.local
    const parts = String(nodeKV.value).split('~');
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

/**
 * Gets the SOURCE workload from a waypoint span.
 * For waypoint server spans, this is the caller workload (from istio.source_* tags).
 * This is different from getWorkloadFromSpan which returns destination for server spans.
 *
 * @param span - The waypoint span
 * @returns Source workload info or undefined
 */
export const getSourceWorkloadFromWaypointSpan = (span: Span): WorkloadAndNamespace | undefined => {
  if (!isWaypointProxySpan(span)) {
    return undefined;
  }
  return ambientWorkloadFromTags(span, 'source');
};

const replicasetFromPodRegex = /^([a-z0-9-.]+)-[a-z0-9]+$/;
const extractWorkloadFromPod = (pod: string, ns: string): WorkloadAndNamespace | undefined => {
  const result = replicasetFromPodRegex.exec(pod);
  if (result && result.length === 2) {
    return {
      namespace: ns,
      pod: pod,
      workload: adjustWorkloadNameFromReplicaset(result[1])
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

export const findParent = (span: Span): Span | undefined => {
  if (Array.isArray(span.references)) {
    const ref = span.references.find(s => s.refType === 'CHILD_OF' || s.refType === 'FOLLOWS_FROM');
    return ref?.span || undefined;
  }
  return undefined;
};

export const findChildren = (span: Span, trace: JaegerTrace): Span[] => {
  return trace.spans.filter(s => findParent(s)?.spanID === span.spanID).sort(spansSort);
};

export const searchParentWorkload = (span: Span): WorkloadAndNamespace | undefined => {
  const parent = findParent(span);
  return parent ? getWorkloadFromSpan(parent) : undefined;
};

type AppAndNamespace = { app: string; namespace: string };

export const getAppFromSpan = (span: Span): AppAndNamespace | undefined => {
  if (isWaypointProxySpan(span)) {
    const kind = tagValue(span, 'span.kind');
    if (kind === 'server' || kind === 'consumer') {
      const app = tagValue(span, 'istio.destination_canonical_service');
      const ns = tagValue(span, 'istio.destination_namespace');
      if (app !== undefined || ns !== undefined) {
        return { app: app || '', namespace: ns || '' };
      }
    } else if (kind === 'client' || kind === 'producer') {
      const app = tagValue(span, 'istio.source_canonical_service');
      const ns = tagValue(span, 'istio.source_namespace');
      if (app !== undefined || ns !== undefined) {
        return { app: app || '', namespace: ns || '' };
      }
    } else {
      const destApp = tagValue(span, 'istio.destination_canonical_service');
      const destNs = tagValue(span, 'istio.destination_namespace');
      if (destApp !== undefined || destNs !== undefined) {
        return { app: destApp || '', namespace: destNs || '' };
      }
      const srcApp = tagValue(span, 'istio.source_canonical_service');
      const srcNs = tagValue(span, 'istio.source_namespace');
      if (srcApp !== undefined || srcNs !== undefined) {
        return { app: srcApp || '', namespace: srcNs || '' };
      }
    }
  }
  const split = span.process.serviceName.split('.');
  return { app: split[0], namespace: split.length > 1 ? split[1] : '' };
};

export const searchParentApp = (span: Span): AppAndNamespace | undefined => {
  const parent = findParent(span);
  return parent ? getAppFromSpan(parent) : undefined;
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

export const extractSpanInfo = (
  span: Span
): {
  info: OpenTracingBaseInfo | OpenTracingHTTPInfo | OpenTracingTCPInfo | EnvoySpanInfo;
  type: ReturnType<typeof getSpanType>;
} => {
  const type = getSpanType(span);
  const info =
    type === 'envoy'
      ? extractEnvoySpanInfo(span)
      : type === 'http'
      ? extractOpenTracingHTTPInfo(span)
      : type === 'tcp'
      ? extractOpenTracingTCPInfo(span)
      : extractOpenTracingBaseInfo(span);
  return { info, type };
};

export const sameSpans = (a: Span[], b: Span[]): boolean => {
  return a.map(s => s.spanID).join() === b.map(s => s.spanID).join();
};

export function formatDuration(micros: number): string {
  let d = micros / 1000;
  let unit = 'ms';
  if (d >= 1000) {
    unit = 's';
    d /= 1000;
  }
  return _round(d, 2) + unit;
}

const TODAY = 'Today';
const YESTERDAY = 'Yesterday';

export function formatRelativeDate(value: any, fullMonthName = false): string {
  const m = moment.isMoment(value) ? value : moment(value);
  const monthFormat = fullMonthName ? 'MMMM' : 'MMM';
  const dt = new Date();
  if (dt.getFullYear() !== m.year()) {
    return m.format(`${monthFormat} D, YYYY`);
  }
  const mMonth = m.month();
  const mDate = m.date();
  const date = dt.getDate();
  if (mMonth === dt.getMonth() && mDate === date) {
    return TODAY;
  }
  dt.setDate(date - 1);
  if (mMonth === dt.getMonth() && mDate === dt.getDate()) {
    return YESTERDAY;
  }
  return m.format(`${monthFormat} D`);
}
