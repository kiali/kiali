import * as React from 'react';
import { Icon } from 'patternfly-react';
import { NodeType, SummaryPanelPropType } from '../../types/Graph';
import { Health, healthNotAvailable } from '../../types/Health';
import MetricsOptions from '../../types/MetricsOptions';
import * as API from '../../services/Api';
import { authentication } from '../../utils/Authentication';
import * as M from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import { Metric } from '../../types/Metrics';
import { Response } from '../../services/Api';

export interface NodeData {
  app: string;
  hasParent: boolean;
  isInaccessible: boolean;
  isOutsider: boolean;
  isRoot: boolean;
  isServiceEntry: boolean;
  namespace: string;
  nodeType: NodeType;
  service: string;
  version: string;
  workload: string;
}

export enum NodeMetricType {
  APP = 1,
  WORKLOAD = 2,
  SERVICE = 3
}

export const shouldRefreshData = (prevProps: SummaryPanelPropType, nextProps: SummaryPanelPropType) => {
  return (
    // Verify the time of the last request
    prevProps.queryTime !== nextProps.queryTime ||
    // Check if going from no data to data
    (!prevProps.data.summaryTarget && nextProps.data.summaryTarget) ||
    // Check if the target changed
    prevProps.data.summaryTarget !== nextProps.data.summaryTarget
  );
};

type HealthState = {
  health?: Health;
  healthLoading: boolean;
};

export const updateHealth = (summaryTarget: any, stateSetter: (hs: HealthState) => void) => {
  const healthPromise = summaryTarget.data('healthPromise');
  if (healthPromise) {
    stateSetter({ health: undefined, healthLoading: true });
    healthPromise
      .then(h => stateSetter({ health: h, healthLoading: false }))
      .catch(err => stateSetter({ health: healthNotAvailable(), healthLoading: false }));
  } else {
    stateSetter({ health: undefined, healthLoading: false });
  }
};

export const nodeData = (node: any): NodeData => {
  return {
    app: node.data('app'),
    hasParent: !!node.data('parent'),
    isInaccessible: node.data('isInaccessible'),
    isOutsider: node.data('isOutsider'),
    isRoot: node.data('isRoot'),
    isServiceEntry: node.data('isServiceEntry'),
    namespace: node.data('namespace'),
    nodeType: node.data('nodeType'),
    service: node.data('service'),
    version: node.data('version'),
    workload: node.data('workload')
  };
};

export const getNodeMetricType = (data: NodeData) => {
  switch (data.nodeType) {
    case NodeType.WORKLOAD:
    case NodeType.UNKNOWN:
      return NodeMetricType.WORKLOAD;
    case NodeType.APP:
      // treat versioned app like a workload to narrow to the specific version
      return data.workload ? NodeMetricType.WORKLOAD : NodeMetricType.APP;
    case NodeType.SERVICE:
      return NodeMetricType.SERVICE;
    default:
      return undefined;
  }
};

export const getNodeMetrics = (
  nodeMetricType: NodeMetricType,
  node: any,
  props: SummaryPanelPropType,
  filters: Array<string>,
  quantiles?: Array<string>,
  byLabelsIn?: Array<string>,
  byLabelsOut?: Array<string>
): Promise<Response<M.Metrics>> => {
  const data = nodeData(node);
  const options: MetricsOptions = {
    queryTime: props.queryTime,
    duration: props.duration,
    step: props.step,
    rateInterval: props.rateInterval,
    filters: filters,
    quantiles: quantiles,
    byLabelsIn: byLabelsIn,
    byLabelsOut: byLabelsOut
  };

  switch (nodeMetricType) {
    case NodeMetricType.APP:
      return API.getAppMetrics(authentication(), data.namespace, data.app, options);
    case NodeMetricType.SERVICE:
      return API.getServiceMetrics(authentication(), data.namespace, data.service, options);
    case NodeMetricType.WORKLOAD:
      return API.getWorkloadMetrics(authentication(), data.namespace, data.workload, options);
    default:
      return Promise.reject(new Error(`Unknown NodeMetricType: ${nodeMetricType}`));
  }
};

export const getDatapoints = (
  mg: M.MetricGroup,
  title: string,
  comparator?: (metric: Metric) => boolean
): [string, number][] => {
  let series: M.TimeSeries[] = [];
  if (mg && mg.matrix) {
    const tsa: M.TimeSeries[] = mg.matrix;
    if (comparator) {
      for (let i = 0; i < tsa.length; ++i) {
        const ts = tsa[i];
        if (comparator(ts.metric)) {
          series.push(ts);
        }
      }
    } else {
      series = mg.matrix;
    }
  }
  return graphUtils.toC3Columns(series, title);
};

export const renderNoTraffic = (protocol?: string) => {
  return (
    <>
      <div>
        <Icon type="pf" name="info" /> No {protocol ? protocol : ''} traffic logged.
      </div>
    </>
  );
};
