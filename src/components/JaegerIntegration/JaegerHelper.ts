import logfmtParser from 'logfmt/lib/logfmt_parser';
import { KeyValuePair, Span } from '../../types/JaegerInfo';
import { retrieveTimeRange } from 'components/Time/TimeRangeHelper';
import { guardTimeRange, durationToBounds } from 'types/Common';

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

const workloadFromNodeRegex = /([a-z0-9-.]+)-[a-z0-9]+-[a-z0-9]+.([a-z0-9-]+)/;
const workloadFromHostnameRegex = /([a-z0-9-.]+)-[a-z0-9]+-[a-z0-9]+/;
type WorkloadAndNamespace = { workload: string; namespace: string };
export const getWorkloadFromSpan = (span: Span): WorkloadAndNamespace | undefined => {
  const nodeKV = span.tags.find(tag => tag.key === 'node_id');
  if (!nodeKV) {
    // Tag not found => try with 'hostname' in process' tags
    const hostnameKV = span.process.tags.find(tag => tag.key === 'hostname');
    if (hostnameKV) {
      const result = workloadFromHostnameRegex.exec(hostnameKV.value);
      if (result && result.length > 1) {
        // As the namespace is not provided here, assume same as service's
        const split = span.process.serviceName.split('.');
        return { workload: result[1], namespace: split.length > 1 ? split[1] : '' };
      }
    }
    return undefined;
  }
  // Example of node value:
  // sidecar~172.17.0.20~ai-locals-6d8996bff-ztg6z.default~default.svc.cluster.local
  const parts = nodeKV.value.split('~');
  if (parts.length < 3) {
    return undefined;
  }
  const result = workloadFromNodeRegex.exec(parts[2]);
  return result && result.length > 2 ? { workload: result[1], namespace: result[2] } : undefined;
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

type OpenTracingHTTPInfo = {
  statusCode?: number;
  url?: string;
  method?: string;
  direction?: 'inbound' | 'outbound';
};

export const extractOpenTracingHTTPInfo = (span: Span): OpenTracingHTTPInfo => {
  // See https://github.com/opentracing/specification/blob/master/semantic_conventions.md
  const info: OpenTracingHTTPInfo = {};
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

type OpenTracingTCPInfo = {
  topic?: string;
  peerAddress?: string;
  peerHostname?: string;
  direction?: 'inbound' | 'outbound';
};

export const extractOpenTracingTCPInfo = (span: Span): OpenTracingTCPInfo => {
  // See https://github.com/opentracing/specification/blob/master/semantic_conventions.md
  const info: OpenTracingTCPInfo = {};
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

type EnvoySpanInfo = OpenTracingHTTPInfo & {
  responseFlags?: string;
  peer?: string;
  peerNamespace?: string;
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
            info.peer = svcParts[0];
            info.peerNamespace = svcParts[1];
          }
        } else if (parts[0] === 'inbound') {
          const wkdNs = searchParentWorkload(span);
          if (wkdNs) {
            info.direction = 'inbound';
            info.peer = wkdNs.workload;
            info.peerNamespace = wkdNs.namespace;
          }
        }
      }
    }
  });
  return info;
};
