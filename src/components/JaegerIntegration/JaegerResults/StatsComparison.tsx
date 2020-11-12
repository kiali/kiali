import * as React from 'react';
import { InfoAltIcon } from '@patternfly/react-icons';
import _round from 'lodash/round';

import * as API from 'services/Api';
import { HeatMap } from 'components/HeatMap/HeatMap';
import { MetricsStatsQuery, Target } from 'types/MetricsOptions';
import { EnvoySpanInfo } from '../JaegerHelper';
import { SpanTableItem } from './SpanTableItem';
import { MetricsStats } from 'types/Metrics';
import { PfColors } from 'components/Pf/PfColors';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';

// TODO / follow-up: these variables are to be removed from here and managed from the toolbar
const statsQuantiles = ['0.5', '0.9', '0.99'];
const statsAvgWithQuantiles = ['avg', ...statsQuantiles];
const statsIntervals = ['10m', '60m', '6h'];
const statsPerPeer = false;
let statsCompareKind: 'app' | 'workload' = 'workload';

const statToText = {
  avg: { short: 'avg', long: 'average' },
  '0.5': { short: 'p50', long: 'median' },
  '0.75': { short: 'p75', long: '75th percentile' },
  '0.8': { short: 'p80', long: '80th percentile' },
  '0.9': { short: 'p90', long: '90th percentile' },
  '0.99': { short: 'p99', long: '99th percentile' },
  '0.999': { short: 'p99.9', long: '99.9th percentile' }
};

export const fetchStats = (spans: SpanTableItem[]) => {
  const queryTime = Math.floor(Date.now() / 1000);
  const queries: MetricsStatsQuery[] = spans.flatMap(span => {
    const info = span.info as EnvoySpanInfo;
    if (!info.direction) {
      console.warn('Could not determine direction from Envoy span.');
      return [];
    }
    if (statsPerPeer && !info.peer) {
      console.warn('Could not determine peer from Envoy span.');
      return [];
    }
    const name = statsCompareKind === 'app' ? span.app : span.workload;
    if (!name) {
      console.warn('Could not determine workload from Envoy span.');
      return [];
    }
    const query: MetricsStatsQuery = {
      queryTime: queryTime,
      target: {
        namespace: span.namespace,
        name: name,
        kind: statsCompareKind
      },
      peerTarget: statsPerPeer ? info.peer : undefined,
      interval: '', // placeholder
      direction: info.direction,
      avg: true,
      quantiles: statsQuantiles
    };
    return statsIntervals.map(interval => ({ ...query, interval: interval }));
  });
  return API.getMetricsStats(deduplicateMetricQueries(queries));
};

const deduplicateMetricQueries = (queries: MetricsStatsQuery[]) => {
  // Exclude redundant queries based on this keygen as a merger, + hashmap
  const dedup = new Map<string, MetricsStatsQuery>();
  queries.forEach(q => {
    const key = genKey(q.target, q.peerTarget, q.direction, q.interval);
    if (key) {
      dedup.set(key, q);
    }
  });
  return Array.from(dedup.values());
};

// !! genKey HAS to mirror backend's models.MetricsStatsQuery#GenKey in models/metrics.go
const genKey = (target: Target, peer: Target | undefined, direction: string, interval: string): string | undefined => {
  const peerKey = peer ? genTargetKey(peer) : '';
  return `${genTargetKey(target)}:${peerKey}:${direction}:${interval}`;
};

const genTargetKey = (target: Target): string | undefined => {
  return `${target.namespace}:${target.kind}:${target.name}`;
};

type StatsWithIntervalIndex = MetricsStats & { intervalIndex: number };
const buildStatsData = (item: SpanTableItem, itemStats: StatsWithIntervalIndex[]) => {
  const data: (number | undefined)[][] = new Array(statsAvgWithQuantiles.length)
    .fill(0)
    .map(() => new Array(statsIntervals.length).fill(0).map(() => undefined));
  const baseLine = item.duration / 1000;

  itemStats.forEach(stats => {
    stats.responseTimes.forEach(stat => {
      const x = statsAvgWithQuantiles.indexOf(stat.name);
      if (x >= 0) {
        data[x][stats.intervalIndex] = baseLine - stat.value;
      }
    });
  });
  return data;
};

const renderHeatMap = (item: SpanTableItem, stats: StatsWithIntervalIndex[]) => {
  const data = buildStatsData(item, stats);
  return (
    <HeatMap
      xLabels={statsAvgWithQuantiles.map(s => statToText[s]?.short || s)}
      yLabels={statsIntervals}
      data={data}
      colorMap={HeatMap.HealthColorMap}
      dataRange={{ from: -10, to: 10 }}
      colorUndefined={PfColors.Black200}
      valueFormat={v => (v > 0 ? '+' : '') + _round(v, 1)}
      tooltip={(x, y, v) => {
        // Build explanation tooltip
        const slowOrFast = v > 0 ? 'slower' : 'faster';
        const stat = statToText[statsAvgWithQuantiles[x]]?.long || statsAvgWithQuantiles[x];
        const interval = statsIntervals[y];
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
  item: SpanTableItem,
  metricsStats: { [key: string]: MetricsStats },
  load: () => void
) => {
  const itemStats = statsIntervals.flatMap((interval, intervalIndex) => {
    const info = item.info as EnvoySpanInfo;
    const target = {
      namespace: item.namespace,
      name: statsCompareKind === 'app' ? item.app : item.workload!,
      kind: statsCompareKind
    };
    const key = genKey(target, statsPerPeer ? info.peer : undefined, info.direction!, interval);
    if (key) {
      const stats = metricsStats[key];
      if (stats) {
        return [{ ...stats, intervalIndex: intervalIndex }];
      }
    }
    return [];
  });
  if (itemStats.length > 0) {
    return (
      <>
        <Tooltip content="This heatmap is a comparison matrix of this request duration against duration statistics aggregated over time. Move the pointer over cells to get more details.">
          <>
            <InfoAltIcon /> <strong>Comparison map: </strong>
          </>
        </Tooltip>
        {renderHeatMap(item, itemStats)}
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
