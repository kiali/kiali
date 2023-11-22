import * as React from 'react';
import { InfoAltIcon } from '@patternfly/react-icons';
import _round from 'lodash/round';
import { HeatMap, healthColorMap } from 'components/HeatMap/HeatMap';
import { MetricsStats } from 'types/Metrics';
import { PFColors } from 'components/Pf/PfColors';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { EnvoySpanInfo, RichSpanData } from 'types/TracingInfo';
import {
  compactStatsIntervals,
  statsIntervals,
  getSpanStats,
  statsQuantilesWithAvg,
  StatsMatrix,
  statsToMatrix,
  StatsWithIntervalIndex,
  statsPerPeer,
  statsCompareKind,
  compactStatsQuantilesWithAvg
} from 'utils/tracing/TraceStats';

const statToText = {
  avg: { short: 'avg', long: 'average' },
  '0.5': { short: 'p50', long: 'median' },
  '0.75': { short: 'p75', long: '75th percentile' },
  '0.8': { short: 'p80', long: '80th percentile' },
  '0.9': { short: 'p90', long: '90th percentile' },
  '0.99': { short: 'p99', long: '99th percentile' },
  '0.999': { short: 'p99.9', long: '99.9th percentile' }
};

const renderHeatMap = (item: RichSpanData, stats: StatsWithIntervalIndex[], isCompact: boolean): React.ReactNode => {
  const key = `${item.spanID}-hm`;
  const intervals = isCompact ? compactStatsIntervals : statsIntervals;
  const quantilesWithAvg = isCompact ? compactStatsQuantilesWithAvg : statsQuantilesWithAvg;

  return (
    <HeatMap
      key={key}
      xLabels={quantilesWithAvg.map(s => statToText[s]?.short ?? s)}
      yLabels={intervals}
      data={statsToMatrix(stats, intervals)}
      displayMode={isCompact ? 'compact' : 'normal'}
      colorMap={healthColorMap}
      dataRange={{ from: -10, to: 10 }}
      colorUndefined={PFColors.ColorLight200}
      valueFormat={v => `${v > 0 ? '+' : ''}${_round(v, 1)}`}
      tooltip={(x, y, v) => {
        // Build explanation tooltip
        const slowOrFast = v > 0 ? 'slower' : 'faster';
        const stat = statToText[quantilesWithAvg[x]]?.long || quantilesWithAvg[x];
        const interval = intervals[y];
        const info = item.info as EnvoySpanInfo;

        let dir = 'from',
          rev = 'to';

        if (info.direction === 'inbound') {
          dir = 'to';
          rev = 'from';
        }

        const thisObj = statsCompareKind === 'app' ? item.app : item.workload;
        const peer = statsPerPeer ? `${rev} ${info.peer}` : '';

        return `This request has been ${_round(Math.abs(v), 2)}ms ${slowOrFast} than the ${stat} of all ${
          info.direction
        } requests ${dir} ${thisObj} ${peer} in the last ${interval}`;
      }}
    />
  );
};

export const renderMetricsComparison = (
  item: RichSpanData,
  isCompact: boolean,
  metricsStats: Map<string, MetricsStats>,
  load: () => void
): React.ReactNode => {
  const itemStats = getSpanStats(item, metricsStats, isCompact);
  const key = `${item.spanID}-metcomp`;

  if (itemStats.length > 0) {
    return (
      <React.Fragment key={key}>
        {!isCompact && (
          <Tooltip
            key={`${key}-tt`}
            content="This heatmap is a comparison matrix of this request duration against duration statistics aggregated over time. Move the pointer over cells to get more details."
          >
            <>
              <InfoAltIcon key={`${key}-ic`} /> <strong key={`${key}-ic-title`}>Comparison map: </strong>
            </>
          </Tooltip>
        )}

        {renderHeatMap(item, itemStats, isCompact)}
      </React.Fragment>
    );
  }

  return (
    <Tooltip key={`${key}-tt`} content="Click to load more statistics for this request">
      <Button key={`${key}-load`} onClick={load} variant={ButtonVariant.link}>
        <strong key={`${key}-load-title`}>Load statistics</strong>
      </Button>
    </Tooltip>
  );
};

export const renderTraceHeatMap = (matrix: StatsMatrix, isCompact: boolean): React.ReactNode => {
  const intervals = isCompact ? compactStatsIntervals : statsIntervals;
  const quantilesWithAvg = isCompact ? compactStatsQuantilesWithAvg : statsQuantilesWithAvg;

  return (
    <HeatMap
      xLabels={quantilesWithAvg.map(s => statToText[s]?.short || s)}
      yLabels={intervals}
      data={matrix}
      displayMode={isCompact ? 'compact' : 'normal'}
      colorMap={healthColorMap}
      dataRange={{ from: -10, to: 10 }}
      colorUndefined={PFColors.ColorLight200}
      valueFormat={v => `${v > 0 ? '+' : ''}${_round(v, 1)}`}
      tooltip={(x, y, v) => {
        // Build explanation tooltip
        const slowOrFast = v > 0 ? 'slower' : 'faster';
        const stat = statToText[quantilesWithAvg[x]]?.long || quantilesWithAvg[x];
        const interval = intervals[y];

        return `Trace requests have been, in average, ${_round(
          Math.abs(v),
          2
        )}ms ${slowOrFast} than the ${stat} of the requests involving the same services in the last ${interval}`;
      }}
    />
  );
};
