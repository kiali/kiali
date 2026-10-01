import * as React from 'react';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { useKialiTranslation } from 'utils/I18nUtils';
import type { Datapoint } from 'types/Metrics';
import { buildHealthStatusSegments, findHealthStatusSegmentAt } from './HealthStatusRibbonUtils';

type HealthStatusRibbonProps = {
  datapoints: Datapoint[];
  endTime: number;
  startTime: number;
};

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

  const segments = React.useMemo(
    () => buildHealthStatusSegments(datapoints, startTime, endTime),
    [datapoints, endTime, startTime]
  );
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
    const segment = findHealthStatusSegmentAt(segments, timestamp);
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
