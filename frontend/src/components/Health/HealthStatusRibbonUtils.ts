import { PFColors } from 'components/Pf/PfColors';
import type { Datapoint } from 'types/Metrics';

export type HealthStatusRibbonSegment = {
  color: string;
  endTime: number;
  label: string;
  startTime: number;
  status: number;
};

const statusMap: Record<number, { color: string; label: string }> = {
  0: { color: PFColors.Success, label: 'Healthy' },
  1: { color: PFColors.Custom, label: 'Not Ready' },
  2: { color: PFColors.Warning, label: 'Degraded' },
  3: { color: PFColors.Danger, label: 'Failure' }
};

const naStatus = { color: PFColors.Color200, label: 'n/a' };

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
  endTime: number
): HealthStatusRibbonSegment[] => {
  if (datapoints.length === 0) {
    return [{ color: naStatus.color, endTime, label: naStatus.label, startTime, status: -1 }];
  }

  const sorted = [...datapoints].sort((a, b) => a[0] - b[0]);
  const segments: HealthStatusRibbonSegment[] = [];

  const statusInfo = (val: number): { color: string; label: string } => statusMap[val] ?? naStatus;

  let prevEnd = startTime;

  for (let i = 0; i < sorted.length; i++) {
    const ts = sorted[i][0];
    const val = Math.round(sorted[i][1]);
    const info = statusInfo(val);

    const nextTs = i + 1 < sorted.length ? sorted[i + 1][0] : endTime;
    const segEnd = Math.min(nextTs, endTime);

    if (ts - prevEnd > 1) {
      const last = segments.length > 0 ? segments[segments.length - 1] : null;
      if (last && last.status === -1) {
        last.endTime = ts;
      } else {
        segments.push({ color: naStatus.color, endTime: ts, label: naStatus.label, startTime: prevEnd, status: -1 });
      }
    }

    const last = segments.length > 0 ? segments[segments.length - 1] : null;
    if (last && last.status === val) {
      last.endTime = segEnd;
    } else {
      segments.push({ color: info.color, endTime: segEnd, label: info.label, startTime: ts, status: val });
    }

    prevEnd = segEnd;
  }

  if (prevEnd < endTime) {
    const last = segments.length > 0 ? segments[segments.length - 1] : null;
    if (last && last.status === -1) {
      last.endTime = endTime;
    } else {
      segments.push({
        color: naStatus.color,
        endTime,
        label: naStatus.label,
        startTime: prevEnd,
        status: -1
      });
    }
  }

  return segments;
};
