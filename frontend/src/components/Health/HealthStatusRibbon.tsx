import * as React from 'react';
import { Tooltip } from '@patternfly/react-core';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { useKialiTranslation } from 'utils/I18nUtils';
import type { Datapoint } from 'types/Metrics';

interface RibbonSegment {
  color: string;
  endTime: number;
  label: string;
  startTime: number;
  status: number;
}

type HealthStatusRibbonProps = {
  datapoints: Datapoint[];
  endTime: number;
  startTime: number;
};

const statusMap: Record<number, { color: string; label: string }> = {
  0: { color: PFColors.Success, label: 'Healthy' },
  1: { color: PFColors.Custom, label: 'Not Ready' },
  2: { color: PFColors.Warning, label: 'Degraded' },
  3: { color: PFColors.Danger, label: 'Failure' }
};

const naStatus = { color: PFColors.Color200, label: 'n/a' };

const ribbonContainerStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  width: '100%'
});

const ribbonBarStyle = kialiStyle({
  borderRadius: '3px',
  display: 'flex',
  height: '1.25rem',
  overflow: 'hidden',
  width: '100%'
});

const timeAxisStyle = kialiStyle({
  display: 'flex',
  fontSize: '0.7rem',
  justifyContent: 'space-between',
  opacity: 0.7
});

const legendStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  fontSize: '0.7rem',
  gap: '0.75rem',
  marginTop: '0.125rem'
});

const legendItemStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  gap: '0.25rem'
});

const legendSwatchStyle = (color: string): React.CSSProperties => ({
  backgroundColor: color,
  borderRadius: '2px',
  display: 'inline-block',
  height: '0.6rem',
  width: '0.6rem'
});

const formatTime = (ts: number): string => {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const buildSegments = (datapoints: Datapoint[], startTime: number, endTime: number): RibbonSegment[] => {
  if (datapoints.length === 0) {
    return [{ color: naStatus.color, endTime, label: naStatus.label, startTime, status: -1 }];
  }

  const sorted = [...datapoints].sort((a, b) => a[0] - b[0]);
  const segments: RibbonSegment[] = [];

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

export const HealthStatusRibbon: React.FC<HealthStatusRibbonProps> = ({
  datapoints,
  endTime,
  startTime
}: HealthStatusRibbonProps) => {
  const { t } = useKialiTranslation();

  const segments = buildSegments(datapoints, startTime, endTime);
  const totalDuration = endTime - startTime;

  const timeLabels: string[] = [];
  const numLabels = 5;
  for (let i = 0; i < numLabels; i++) {
    const ts = startTime + (totalDuration * i) / (numLabels - 1);
    timeLabels.push(formatTime(ts));
  }

  const legendEntries = [
    { color: statusMap[0].color, label: t('Healthy') },
    { color: statusMap[1].color, label: t('Not Ready') },
    { color: statusMap[2].color, label: t('Degraded') },
    { color: statusMap[3].color, label: t('Failure') },
    { color: naStatus.color, label: t('n/a') }
  ];

  return (
    <div className={ribbonContainerStyle}>
      <div className={ribbonBarStyle}>
        {segments.map((seg, idx) => {
          const width = totalDuration > 0 ? ((seg.endTime - seg.startTime) / totalDuration) * 100 : 0;
          if (width <= 0) {
            return null;
          }
          const tooltipContent = `${t(seg.label)}: ${formatTime(seg.startTime)} – ${formatTime(seg.endTime)}`;
          return (
            <Tooltip key={`${seg.startTime}-${seg.endTime}-${seg.status}`} content={tooltipContent}>
              <div
                data-test={`health-ribbon-segment-${idx}`}
                style={{
                  backgroundColor: seg.color,
                  flexBasis: `${width}%`,
                  flexGrow: 0,
                  flexShrink: 0,
                  minWidth: '2px'
                }}
              />
            </Tooltip>
          );
        })}
      </div>

      <div className={timeAxisStyle}>
        {timeLabels.map(label => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className={legendStyle}>
        {legendEntries.map(entry => (
          <span key={entry.label} className={legendItemStyle}>
            <span style={legendSwatchStyle(entry.color)} />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
};
