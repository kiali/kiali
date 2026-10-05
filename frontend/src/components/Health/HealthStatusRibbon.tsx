import * as React from 'react';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { useKialiTranslation } from 'utils/I18nUtils';
import { NA, type HealthStatusId } from 'types/Health';
import type { Datapoint } from 'types/Metrics';
import { buildHealthStatusSegments, findHealthStatusSegmentAt, formatAxisTimeLabel } from './HealthStatusRibbonUtils';

type HealthStatusRibbonProps = {
  datapoints: Datapoint[];
  endTime: number;
  startTime: number;
  step: number;
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
  marginTop: '0.25rem',
  position: 'absolute',
  top: '100%',
  transform: 'translateX(-50%)',
  whiteSpace: 'nowrap',
  zIndex: 1
});

const clampTooltipLeft = (cursorX: number, barWidth: number, tooltipWidth: number): number => {
  if (barWidth <= 0 || tooltipWidth <= 0) {
    return cursorX;
  }

  const halfWidth = tooltipWidth / 2;
  return Math.max(halfWidth, Math.min(barWidth - halfWidth, cursorX));
};

const ribbonBarStyle = kialiStyle({
  borderRadius: '3px',
  cursor: 'crosshair',
  display: 'flex',
  height: '0.625rem',
  overflow: 'hidden',
  width: '100%'
});

const ribbonSegmentStyle = kialiStyle({
  flexGrow: 0,
  flexShrink: 0,
  minWidth: '2px'
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
  label: HealthStatusId;
  timestamp: number;
};

const healthStatusI18nKey = (id: HealthStatusId): string => (id === NA.id ? 'n/a' : id);

export const HealthStatusRibbon: React.FC<HealthStatusRibbonProps> = ({
  datapoints,
  endTime,
  startTime,
  step
}: HealthStatusRibbonProps) => {
  const { t } = useKialiTranslation();
  const barRef = React.useRef<HTMLDivElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<HoverInfo | null>(null);
  const [tooltipWidth, setTooltipWidth] = React.useState(0);

  const segments = React.useMemo(
    () => buildHealthStatusSegments(datapoints, startTime, endTime, step),
    [datapoints, endTime, startTime, step]
  );
  const totalDuration = endTime - startTime;
  const today = new Date();

  React.useLayoutEffect(() => {
    if (!hover || !tooltipRef.current) {
      setTooltipWidth(0);
      return;
    }

    setTooltipWidth(tooltipRef.current.offsetWidth);
  }, [hover]);

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

  const timeLabels: { label: string; ts: number }[] = [];
  const numLabels = 5;
  for (let i = 0; i < numLabels; i++) {
    const ts = startTime + (totalDuration * i) / (numLabels - 1);
    timeLabels.push({ label: formatAxisTimeLabel(ts, totalDuration, today), ts });
  }

  const barWidth = barRef.current?.offsetWidth ?? 0;
  const tooltipLeft = hover ? clampTooltipLeft(hover.cursorX, barWidth, tooltipWidth) : 0;

  return (
    <div className={ribbonContainerStyle}>
      <div className={ribbonBarWrapperStyle}>
        {hover && (
          <div
            ref={tooltipRef}
            className={hoverLabelStyle}
            data-test="health-ribbon-hover-label"
            style={{ left: `${tooltipLeft}px` }}
          >
            {`${t(healthStatusI18nKey(hover.label))}: ${formatTooltipTime(hover.timestamp, today)}`}
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
                className={ribbonSegmentStyle}
                data-test={`health-ribbon-segment-${idx}`}
                style={{
                  backgroundColor: seg.color,
                  flexBasis: `${width}%`
                }}
              />
            );
          })}
        </div>
      </div>

      <div className={timeAxisStyle}>
        {timeLabels.map(({ label, ts }) => (
          <span key={ts}>{label}</span>
        ))}
      </div>
    </div>
  );
};
