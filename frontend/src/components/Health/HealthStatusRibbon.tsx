import * as React from 'react';
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

const ribbonBarWrapperStyle = kialiStyle({
  position: 'relative',
  width: '100%'
});

const hoverLabelStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor200,
  border: `1px solid ${PFColors.BorderDefault}`,
  borderRadius: '3px',
  fontSize: '0.75rem',
  left: 0,
  padding: '0.125rem 0.375rem',
  pointerEvents: 'none',
  position: 'absolute',
  top: '-1.75rem',
  transform: 'translateX(-50%)',
  whiteSpace: 'nowrap',
  zIndex: 1
});

const ribbonBarStyle = kialiStyle({
  borderRadius: '3px',
  cursor: 'crosshair',
  display: 'flex',
  height: '0.625rem',
  overflow: 'hidden',
  width: '100%'
});

const timeAxisStyle = kialiStyle({
  display: 'flex',
  fontSize: '0.7rem',
  justifyContent: 'space-between',
  opacity: 0.7
});

const isSameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const formatTime = (ts: number): string => {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatTooltipTime = (ts: number, today: Date): string => {
  const d = new Date(ts * 1000);
  if (isSameCalendarDay(d, today)) {
    return formatTime(ts);
  }

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short'
  };
  if (d.getFullYear() !== today.getFullYear()) {
    options.year = 'numeric';
  }
  return d.toLocaleString([], options);
};

const findSegmentAt = (segments: RibbonSegment[], timestamp: number): RibbonSegment | undefined => {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (timestamp >= segments[i].startTime) {
      return segments[i];
    }
  }
  return segments[0];
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

type HoverInfo = {
  cursorX: number;
  label: string;
  timestamp: number;
};

export const HealthStatusRibbon: React.FC<HealthStatusRibbonProps> = ({
  datapoints,
  endTime,
  startTime
}: HealthStatusRibbonProps) => {
  const { t } = useKialiTranslation();
  const barRef = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<HoverInfo | null>(null);

  const segments = buildSegments(datapoints, startTime, endTime);
  const totalDuration = endTime - startTime;
  const today = new Date();

  const handleBarMouseMove = (event: React.MouseEvent<HTMLDivElement>): void => {
    const bar = barRef.current;
    if (!bar || totalDuration <= 0) {
      return;
    }

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const timestamp = Math.round(startTime + ratio * totalDuration);
    const segment = findSegmentAt(segments, timestamp);
    if (!segment) {
      return;
    }

    setHover({
      cursorX: event.clientX - rect.left,
      label: segment.label,
      timestamp
    });
  };

  const handleBarMouseLeave = (): void => {
    setHover(null);
  };

  const timeLabels: string[] = [];
  const numLabels = 5;
  for (let i = 0; i < numLabels; i++) {
    const ts = startTime + (totalDuration * i) / (numLabels - 1);
    timeLabels.push(formatTime(ts));
  }

  return (
    <div className={ribbonContainerStyle}>
      <div className={ribbonBarWrapperStyle}>
        {hover && (
          <div className={hoverLabelStyle} style={{ left: `${hover.cursorX}px` }} data-test="health-ribbon-hover-label">
            {`${t(hover.label)}: ${formatTooltipTime(hover.timestamp, today)}`}
          </div>
        )}
        <div
          ref={barRef}
          className={ribbonBarStyle}
          data-test="health-ribbon-bar"
          onMouseLeave={handleBarMouseLeave}
          onMouseMove={handleBarMouseMove}
        >
          {segments.map((seg, idx) => {
            const width = totalDuration > 0 ? ((seg.endTime - seg.startTime) / totalDuration) * 100 : 0;
            if (width <= 0) {
              return null;
            }
            return (
              <div
                key={`${seg.startTime}-${seg.endTime}-${seg.status}`}
                data-test={`health-ribbon-segment-${idx}`}
                style={{
                  backgroundColor: seg.color,
                  flexBasis: `${width}%`,
                  flexGrow: 0,
                  flexShrink: 0,
                  minWidth: '2px'
                }}
              />
            );
          })}
        </div>
      </div>

      <div className={timeAxisStyle}>
        {timeLabels.map(label => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
};
