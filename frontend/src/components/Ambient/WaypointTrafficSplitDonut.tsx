import * as React from 'react';
import { ChartDonut } from '@patternfly/react-charts/victory';
import { VictoryPie } from 'victory-pie';
import type { CallbackArgs } from 'victory-core';
import { istioCanaryUpgradeChartColorScale } from 'utils/IstioCanaryUpgradeChart';
import type { WaypointTrafficSplit } from '../../types/WaypointTraffic';
import { t } from 'utils/I18nUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { PFFontSize, PFFontWeight } from 'styles/PfTypography';
import { buildWaypointTrafficSplitSlices } from 'utils/WaypointTrafficUtils';

const chartBoxStyle = (compact: boolean): string =>
  kialiStyle({
    height: compact ? '5.5rem' : '200px',
    position: 'relative',
    width: compact ? '5.5rem' : '220px'
  });

const centerLabelStyle = kialiStyle({
  color: 'var(--pf-t--global--text--color--regular)',
  fontSize: PFFontSize.small,
  fontWeight: PFFontWeight.BodyBold,
  left: '50%',
  lineHeight: 1.15,
  pointerEvents: 'none',
  position: 'absolute',
  textAlign: 'center',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  width: '3.5rem'
});

const sliceIndexFromArgs = (args: CallbackArgs): number | undefined => {
  const { index } = args;
  if (index === undefined) {
    return undefined;
  }
  const sliceIndex = typeof index === 'number' ? index : Number(index);
  return Number.isNaN(sliceIndex) ? undefined : sliceIndex;
};

const buildSliceOpacity = (hoveredSlice: number | undefined): ((args: CallbackArgs) => number) => {
  return (args: CallbackArgs): number => {
    const sliceIndex = sliceIndexFromArgs(args);
    if (sliceIndex === undefined) {
      return 1;
    }
    return hoveredSlice !== undefined && hoveredSlice !== sliceIndex ? 0.35 : 1;
  };
};

type WaypointSplitHoverEvents = {
  eventHandlers: {
    onMouseEnter: (event: unknown, props: CallbackArgs) => void;
    onMouseLeave: () => void;
  };
  target: 'data';
}[];

const buildSliceHoverEvents = (
  setHoveredSlice: React.Dispatch<React.SetStateAction<number | undefined>>
): WaypointSplitHoverEvents => [
  {
    target: 'data' as const,
    eventHandlers: {
      onMouseEnter: (_event: unknown, props: CallbackArgs) => {
        const sliceIndex = sliceIndexFromArgs(props);
        if (sliceIndex !== undefined) {
          setHoveredSlice(sliceIndex);
        }
      },
      onMouseLeave: () => {
        setHoveredSlice(undefined);
      }
    }
  }
];

type Props = {
  compact?: boolean;
  split: WaypointTrafficSplit;
};

export const WaypointTrafficSplitDonut: React.FC<Props> = ({ compact, split }) => {
  const slices = buildWaypointTrafficSplitSlices(split);
  const [hoveredSlice, setHoveredSlice] = React.useState<number | undefined>(undefined);

  const height = compact ? 88 : 200;
  const width = compact ? 88 : 220;
  const hovered = hoveredSlice !== undefined ? slices[hoveredSlice] : undefined;
  const title = hovered ? `${hovered.role} (${hovered.share}%)` : '';
  const subTitle = hovered ? hovered.workloadName : t('Traffic split');
  const sliceOpacity = buildSliceOpacity(hoveredSlice);
  const sliceHoverEvents = React.useMemo(() => buildSliceHoverEvents(setHoveredSlice), []);

  if (compact) {
    return (
      <div className={chartBoxStyle(true)} data-test="waypoint-traffic-split-donut">
        <VictoryPie
          colorScale={[...istioCanaryUpgradeChartColorScale]}
          data={slices}
          events={sliceHoverEvents}
          height={height}
          innerRadius={28}
          labels={() => null}
          padding={4}
          radius={40}
          style={{ data: { opacity: sliceOpacity } }}
          width={width}
          x="workloadName"
          y="share"
        />
        {hovered && (
          <span className={centerLabelStyle} data-test="waypoint-traffic-split-donut-label">
            {`${hovered.role} (${hovered.share}%)`}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={chartBoxStyle(false)} data-test="waypoint-traffic-split-donut">
      <ChartDonut
        allowTooltip={false}
        colorScale={[...istioCanaryUpgradeChartColorScale]}
        constrainToVisibleArea
        data={slices}
        events={sliceHoverEvents}
        height={height}
        labels={({ datum }) => `${datum.workloadName}: ${datum.share}%`}
        padding={{
          bottom: 20,
          left: 20,
          right: 20,
          top: 20
        }}
        style={{
          data: { opacity: sliceOpacity }
        }}
        subTitle={subTitle}
        title={title}
        width={width}
        x="workloadName"
        y="share"
      />
    </div>
  );
};
