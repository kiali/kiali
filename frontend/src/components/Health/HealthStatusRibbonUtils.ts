import { DEGRADED, FAILURE, HEALTHY, NA, NOT_READY, type HealthStatusId } from 'types/Health';
import type { Datapoint } from 'types/Metrics';

export type HealthStatusRibbonSegment = {
  color: string;
  endTime: number;
  label: HealthStatusId;
  startTime: number;
  status: number;
};

const statusMap: Record<number, { color: string; label: HealthStatusId }> = {
  0: { color: HEALTHY.color, label: HEALTHY.id as HealthStatusId },
  1: { color: NOT_READY.color, label: NOT_READY.id as HealthStatusId },
  2: { color: DEGRADED.color, label: DEGRADED.id as HealthStatusId },
  3: { color: FAILURE.color, label: FAILURE.id as HealthStatusId }
};

const naStatus = { color: NA.color, label: NA.id as HealthStatusId };

const ONE_DAY_SECONDS = 86400;

export const formatAxisTimeLabel = (ts: number, totalDuration: number, today: Date): string => {
  const d = new Date(ts * 1000);

  if (totalDuration <= ONE_DAY_SECONDS) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short'
  };
  if (d.getFullYear() !== today.getFullYear()) {
    options.year = 'numeric';
  }
  return d.toLocaleDateString([], options);
};

export const findHealthStatusSegmentAt = (
  segments: HealthStatusRibbonSegment[],
  timestamp: number
): HealthStatusRibbonSegment | undefined => {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (timestamp >= segments[i].startTime) {
      return segments[i];
    }
  }
  return segments[0];
};

// Align query bounds to the Prometheus range step (same as /api/v1/query_range).
export const alignPrometheusRange = (
  queryEnd: number,
  duration: number,
  step: number
): { endTime: number; startTime: number } => {
  if (step <= 0 || duration <= 0) {
    return { endTime: queryEnd, startTime: queryEnd - duration };
  }

  const rawStart = queryEnd - duration;
  const startTime = Math.floor(rawStart / step) * step;
  return { endTime: queryEnd, startTime };
};

const bucketIndex = (timestamp: number, rangeStart: number, step: number): number =>
  Math.round((timestamp - rangeStart) / step);

const assignDatapointsToBuckets = (
  datapoints: Datapoint[],
  rangeStart: number,
  rangeEnd: number,
  step: number
): Map<number, number> => {
  const buckets = new Map<number, number>();
  const maxIndex = Math.max(0, Math.floor((rangeEnd - rangeStart) / step));

  datapoints.forEach(dp => {
    const ts = dp[0];
    const index = bucketIndex(ts, rangeStart, step);
    if (index < 0 || index > maxIndex) {
      return;
    }

    const bucketTime = rangeStart + index * step;
    if (!buckets.has(bucketTime)) {
      buckets.set(bucketTime, Math.round(dp[1]));
    }
  });

  return buckets;
};

export const buildHealthStatusSegments = (
  datapoints: Datapoint[],
  startTime: number,
  endTime: number,
  step: number
): HealthStatusRibbonSegment[] => {
  if (endTime <= startTime || step <= 0) {
    return [{ color: naStatus.color, endTime, label: naStatus.label, startTime, status: -1 }];
  }

  const buckets = assignDatapointsToBuckets(datapoints, startTime, endTime, step);
  const segments: HealthStatusRibbonSegment[] = [];

  const statusInfo = (val: number): { color: string; label: HealthStatusId; status: number } => {
    const mapped = statusMap[val];
    if (mapped) {
      return { ...mapped, status: val };
    }
    return { ...naStatus, status: -1 };
  };

  const pushSegment = (segmentStart: number, segmentEnd: number, status: number): void => {
    if (segmentEnd <= segmentStart) {
      return;
    }

    const info = status === -1 ? { ...naStatus, status: -1 } : statusInfo(status);
    const last = segments.length > 0 ? segments[segments.length - 1] : null;
    if (last && last.status === info.status) {
      last.endTime = segmentEnd;
      return;
    }

    segments.push({
      color: info.color,
      endTime: segmentEnd,
      label: info.label,
      startTime: segmentStart,
      status: info.status
    });
  };

  for (let t = startTime; t < endTime; t += step) {
    const bucketEnd = Math.min(t + step, endTime);
    const status = buckets.has(t) ? buckets.get(t)! : -1;
    pushSegment(t, bucketEnd, status);
  }

  if (segments.length === 0) {
    return [{ color: naStatus.color, endTime, label: naStatus.label, startTime, status: -1 }];
  }

  return segments;
};
