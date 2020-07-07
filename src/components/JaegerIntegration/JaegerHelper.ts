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

const workloadFromNodeRegex = new RegExp(`([a-z0-9-\\.]+)-[a-z0-9]+-[a-z0-9]+\\.([a-z0-9-]+)`);
type WorkloadAndNamespace = { workload: string; namespace: string };
export const getWorkloadFromSpan = (span: Span): WorkloadAndNamespace | undefined => {
  const nodeKV = span.tags.find(tag => tag.key === 'node_id');
  if (!nodeKV) {
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
