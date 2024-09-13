import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import {
  NodeType,
  SummaryPanelPropType,
  Protocol,
  DecoratedGraphNodeData,
  BoxByType,
  GraphNodeData
} from '../../types/Graph';
import { IstioMetricsOptions, Reporter, Direction } from '../../types/MetricsOptions';
import * as API from '../../services/Api';
import * as M from '../../types/Metrics';
import { KialiIcon } from 'config/KialiIcon';
import { PFColors } from 'components/Pf/PfColors';
import { ApiResponse } from 'types/Api';

export enum NodeMetricType {
  APP = 1,
  WORKLOAD = 2,
  SERVICE = 3,
  AGGREGATE = 4,
  CLUSTER = 5,
  NAMESPACE = 6
}

export const summaryBodyTabs = kialiStyle({
  padding: '0.5rem 1rem 0 1rem'
});

export const summaryPanelWidth = '350px';

export const summaryPanel = kialiStyle({
  fontSize: 'var(--graph-side-panel--font-size)',
  height: '100%',
  margin: 0,
  minWidth: summaryPanelWidth,
  overflowY: 'scroll',
  padding: 0,
  position: 'relative',
  width: summaryPanelWidth
});

export const summaryFont: React.CSSProperties = {
  fontSize: 'var(--graph-side-panel--font-size)'
};

export const summaryTitle = kialiStyle({
  fontWeight: 'bolder',
  marginTop: '0.25rem',
  marginBottom: '0.25rem',
  textAlign: 'left'
});

export const noTrafficStyle = kialiStyle({
  marginTop: '0.25rem',
  $nest: {
    '& .pf-v5-c-icon': {
      marginRight: '0.25rem'
    }
  }
});

const hrStyle = kialiStyle({
  border: 0,
  borderTop: `1px solid ${PFColors.BorderColor100}`,
  margin: '0.5rem 0'
});

export const hr = (): React.ReactNode => {
  return <hr className={hrStyle} />;
};

export const shouldRefreshData = (prevProps: SummaryPanelPropType, nextProps: SummaryPanelPropType): boolean => {
  return (
    // Verify the time of the last request
    prevProps.queryTime !== nextProps.queryTime ||
    // Check if going from no data to data
    (!prevProps.data.summaryTarget && nextProps.data.summaryTarget) ||
    // Check if the target changed
    prevProps.data.summaryTarget !== nextProps.data.summaryTarget
  );
};

export const getNodeMetricType = (nodeData: DecoratedGraphNodeData): NodeMetricType => {
  switch (nodeData.nodeType) {
    case NodeType.AGGREGATE:
      return NodeMetricType.AGGREGATE;
    case NodeType.APP:
      // treat versioned app like a workload to narrow to the specific version
      return nodeData.workload ? NodeMetricType.WORKLOAD : NodeMetricType.APP;
    case NodeType.BOX:
      switch (nodeData.isBox) {
        case BoxByType.APP:
          return NodeMetricType.APP;
        case BoxByType.CLUSTER:
          return NodeMetricType.CLUSTER;
        case BoxByType.NAMESPACE:
        default:
          return NodeMetricType.NAMESPACE;
      }
    case NodeType.SERVICE:
      return NodeMetricType.SERVICE;
    default:
      // treat UNKNOWN as a workload with name="unknown"
      return NodeMetricType.WORKLOAD;
  }
};

export const getNodeMetrics = (
  nodeMetricType: NodeMetricType,
  nodeData: DecoratedGraphNodeData,
  props: SummaryPanelPropType,
  filters: Array<string>,
  direction: Direction,
  reporter: Reporter,
  includeAmbient?: boolean,
  requestProtocol?: string,
  quantiles?: Array<string>,
  byLabels?: Array<string>
): Promise<ApiResponse<M.IstioMetricsMap>> => {
  const options: IstioMetricsOptions = {
    byLabels: byLabels,
    direction: direction,
    duration: props.duration,
    filters: filters,
    includeAmbient: !!includeAmbient,
    quantiles: quantiles,
    queryTime: props.queryTime,
    rateInterval: props.rateInterval,
    reporter: reporter,
    requestProtocol: requestProtocol,
    step: props.step
  };

  switch (nodeMetricType) {
    case NodeMetricType.AGGREGATE:
      return API.getAggregateMetrics(nodeData.namespace, nodeData.aggregate!, nodeData.aggregateValue!, options);
    case NodeMetricType.APP:
      return API.getAppMetrics(nodeData.namespace, nodeData.app!, options, nodeData.cluster);
    case NodeMetricType.SERVICE:
      return API.getServiceMetrics(nodeData.namespace, nodeData.service!, options, nodeData.cluster);
    case NodeMetricType.WORKLOAD:
      return API.getWorkloadMetrics(nodeData.namespace, nodeData.workload!, options, nodeData.cluster);
    default:
      return Promise.reject(new Error(`Unknown NodeMetricType: ${nodeMetricType}`));
  }
};

export const mergeMetricsResponses = async (
  promises: Promise<ApiResponse<M.IstioMetricsMap>>[]
): Promise<ApiResponse<M.IstioMetricsMap>> => {
  return Promise.all(promises).then(responses => {
    const metrics: M.IstioMetricsMap = {};

    responses.forEach(r => {
      Object.keys(r.data).forEach(k => {
        metrics[k] = r.data[k];
      });
    });

    return {
      data: metrics
    };
  });
};

export const getFirstDatapoints = (metric?: M.Metric[]): M.Datapoint[] => {
  return metric && metric.length > 0 ? metric[0].datapoints : [];
};

export const getDatapoints = (
  metrics: M.Metric[] | undefined,
  comparator: (metric: M.Labels, protocol?: Protocol) => boolean,
  protocol?: Protocol
): M.Datapoint[] => {
  let dpsMap = new Map<number, M.Datapoint>();

  if (metrics) {
    for (let i = 0; i < metrics.length; ++i) {
      const ts = metrics[i];

      if (comparator(ts.labels, protocol)) {
        // Sum values, because several metrics can satisfy the comparator
        // E.g. with multiple active namespaces and node being an outsider, we need to sum datapoints for every active namespace
        ts.datapoints.forEach(dp => {
          const val = Number(dp[1]);

          if (!isNaN(val)) {
            const current = dpsMap.get(dp[0]);
            dpsMap.set(dp[0], current ? [dp[0], current[1] + val] : [dp[0], val]);
          }
        });
      }
    }
  }

  return Array.from(dpsMap.values());
};

export const renderNoTraffic = (protocol?: string): React.ReactNode => {
  return (
    <div className={noTrafficStyle}>
      <KialiIcon.Info /> No {protocol ? protocol : ''} traffic logged.
    </div>
  );
};

export const getTitle = (title: string, ambient?: React.ReactElement): React.ReactNode => {
  switch (title) {
    case NodeType.AGGREGATE:
      title = 'Operation';
      break;
    case NodeType.APP:
      title = 'Application';
      break;
    case NodeType.SERVICE:
      title = 'Service';
      break;
    case NodeType.WORKLOAD:
      title = 'Workload';
      break;
  }
  return (
    <div className={summaryTitle}>
      {title} {ambient}
    </div>
  );
};

export const getAppName = (node: GraphNodeData): string => {
  switch (node.nodeType) {
    case NodeType.APP:
      return node.app ? node.app : '';
    case NodeType.SERVICE:
      return node.service ? node.service : '';
    case NodeType.WORKLOAD:
      return node.workload ? node.workload : '';
    default:
      return '';
  }
};
