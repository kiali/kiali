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

export const buildHealthStatusSegments = (
  datapoints: Datapoint[],
  startTime: number,
  endTime: number,
  step: number
): HealthStatusRibbonSegment[] => {
  if (datapoints.length === 0) {
    return [{ color: naStatus.color, endTime, label: naStatus.label, startTime, status: -1 }];
  }

  const sorted = [...datapoints].sort((a, b) => a[0] - b[0]);
  const segments: HealthStatusRibbonSegment[] = [];

  const statusInfo = (val: number): { color: string; label: HealthStatusId } => statusMap[val] ?? naStatus;

  const pushNaSegment = (segmentStart: number, segmentEnd: number): void => {
    if (segmentEnd <= segmentStart) {
      return;
    }

    const last = segments.length > 0 ? segments[segments.length - 1] : null;
    if (last && last.status === -1) {
      last.endTime = segmentEnd;
    } else {
      segments.push({
        color: naStatus.color,
        endTime: segmentEnd,
        label: naStatus.label,
        startTime: segmentStart,
        status: -1
      });
    }
  };

  let prevEnd = startTime;

  for (let i = 0; i < sorted.length; i++) {
    const ts = sorted[i][0];
    const val = Math.round(sorted[i][1]);
    const info = statusInfo(val);
    const boundedEnd = Math.min(ts + step, endTime);

    if (ts > prevEnd + 1) {
      pushNaSegment(prevEnd, ts);
    }

    const last = segments.length > 0 ? segments[segments.length - 1] : null;
    if (last && last.status === val && last.endTime >= ts) {
      last.endTime = Math.max(last.endTime, boundedEnd);
    } else {
      if (last && last.endTime > ts) {
        last.endTime = ts;
      }
      segments.push({ color: info.color, endTime: boundedEnd, label: info.label, startTime: ts, status: val });
    }

    prevEnd = boundedEnd;

    const nextTs = i + 1 < sorted.length ? sorted[i + 1][0] : undefined;
    if (nextTs !== undefined) {
      if (nextTs > prevEnd + 1) {
        pushNaSegment(prevEnd, nextTs);
        prevEnd = nextTs;
      }
    } else if (prevEnd < endTime) {
      pushNaSegment(prevEnd, endTime);
    }
  }

  return segments;
};
