import * as React from 'react';
import { InfoAltIcon } from '@patternfly/react-icons';
import _round from 'lodash/round';

import { HeatMap } from 'components/HeatMap/HeatMap';
import { MetricsStats } from 'types/Metrics';
import { PfColors } from 'components/Pf/PfColors';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { EnvoySpanInfo, RichSpanData } from 'types/JaegerInfo';
import {
  compactStatsIntervals,
  allStatsIntervals,
  getSpanStats,
  statsAvgWithQuantiles,
  StatsMatrix,
  statsToMatrix,
  StatsWithIntervalIndex,
  statsPerPeer,
  statsCompareKind
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

const renderHeatMap = (
  item: RichSpanData,
  stats: StatsWithIntervalIndex[],
  intervals: string[],
  compactMode: boolean
) => {
  return (
    <HeatMap
      xLabels={statsAvgWithQuantiles.map(s => statToText[s]?.short || s)}
      yLabels={intervals}
      data={statsToMatrix(stats, intervals)}
      displayMode={compactMode ? 'compact' : 'normal'}
      colorMap={HeatMap.HealthColorMap}
      dataRange={{ from: -10, to: 10 }}
      colorUndefined={PfColors.Black200}
      valueFormat={v => (v > 0 ? '+' : '') + _round(v, 1)}
      tooltip={(x, y, v) => {
        // Build explanation tooltip
        const slowOrFast = v > 0 ? 'slower' : 'faster';
        const stat = statToText[statsAvgWithQuantiles[x]]?.long || statsAvgWithQuantiles[x];
        const interval = intervals[y];
        const info = item.info as EnvoySpanInfo;
        let dir = 'from',
          rev = 'to';
        if (info.direction === 'inbound') {
          dir = 'to';
          rev = 'from';
        }
        const thisObj = statsCompareKind === 'app' ? item.app : item.workload;
        const peer = statsPerPeer ? rev + ' ' + info.peer : '';
        return `This request has been ${_round(Math.abs(v), 2)}ms ${slowOrFast} than the ${stat} of all ${
          info.direction
        } requests ${dir} ${thisObj} ${peer} in the last ${interval}`;
      }}
    />
  );
};

export const renderMetricsComparison = (
  item: RichSpanData,
  compactMode: boolean,
  metricsStats: Map<string, MetricsStats>,
  load: () => void
) => {
  const intervals = compactMode ? compactStatsIntervals : allStatsIntervals;
  const itemStats = getSpanStats(item, intervals, metricsStats);
  if (itemStats.length > 0) {
    return (
      <>
        {!compactMode && (
          <Tooltip content="This heatmap is a comparison matrix of this request duration against duration statistics aggregated over time. Move the pointer over cells to get more details.">
            <>
              <InfoAltIcon /> <strong>Comparison map: </strong>
            </>
          </Tooltip>
        )}
        {renderHeatMap(item, itemStats, intervals, compactMode)}
      </>
    );
  }
  return (
    <Tooltip content="Click to load more statistics for this request">
      <Button onClick={load} variant={ButtonVariant.link}>
        <strong>Load statistics</strong>
      </Button>
    </Tooltip>
  );
};

export const renderTraceHeatMap = (matrix: StatsMatrix, intervals: string[], compactMode: boolean) => {
  return (
    <HeatMap
      xLabels={statsAvgWithQuantiles.map(s => statToText[s]?.short || s)}
      yLabels={intervals}
      data={matrix}
      displayMode={compactMode ? 'compact' : 'normal'}
      colorMap={HeatMap.HealthColorMap}
      dataRange={{ from: -10, to: 10 }}
      colorUndefined={PfColors.Black200}
      valueFormat={v => (v > 0 ? '+' : '') + _round(v, 1)}
      tooltip={(x, y, v) => {
        // Build explanation tooltip
        const slowOrFast = v > 0 ? 'slower' : 'faster';
        const stat = statToText[statsAvgWithQuantiles[x]]?.long || statsAvgWithQuantiles[x];
        const interval = intervals[y];
        return `Trace requests have been, in average, ${_round(
          Math.abs(v),
          2
        )}ms ${slowOrFast} than the ${stat} of the requests involving the same services in the last ${interval}`;
      }}
    />
  );
};
