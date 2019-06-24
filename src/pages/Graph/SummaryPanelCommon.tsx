import * as React from 'react';
import { Icon } from 'patternfly-react';
import { NodeType, SummaryPanelPropType, Protocol } from '../../types/Graph';
import { Health, healthNotAvailable } from '../../types/Health';
import { IstioMetricsOptions, Reporter, Direction } from '../../types/MetricsOptions';
import * as API from '../../services/Api';
import * as M from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import { Metric } from '../../types/Metrics';
import { Response } from '../../services/Api';
import Label from '../../components/Label/Label';
import { serverConfig } from '../../config/ServerConfig';
import { CyNode } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';

export interface NodeData {
  app: string;
  hasParent: boolean;
  isInaccessible: boolean;
  isOutsider: boolean;
  isRoot: boolean;
  isServiceEntry: string | undefined;
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
      .catch(_err => stateSetter({ health: healthNotAvailable(), healthLoading: false }));
  } else {
    stateSetter({ health: undefined, healthLoading: false });
  }
};

export const nodeData = (node: any): NodeData => {
  return {
    app: node.data(CyNode.app),
    hasParent: !!node.data('parent'),
    isInaccessible: node.data(CyNode.isInaccessible),
    isOutsider: node.data(CyNode.isOutside),
    isRoot: node.data(CyNode.isRoot),
    isServiceEntry: node.data(CyNode.isServiceEntry),
    namespace: node.data(CyNode.namespace),
    nodeType: node.data(CyNode.nodeType),
    service: node.data(CyNode.service),
    version: node.data(CyNode.version),
    workload: node.data(CyNode.workload)
  };
};

export const getNodeMetricType = (data: NodeData): NodeMetricType => {
  switch (data.nodeType) {
    case NodeType.APP:
      // treat versioned app like a workload to narrow to the specific version
      return data.workload ? NodeMetricType.WORKLOAD : NodeMetricType.APP;
    case NodeType.SERVICE:
      return NodeMetricType.SERVICE;
    default:
      // treat UNKNOWN as a workload with name="unknown"
      return NodeMetricType.WORKLOAD;
  }
};

export const getNodeMetrics = (
  nodeMetricType: NodeMetricType,
  node: any,
  props: SummaryPanelPropType,
  filters: Array<string>,
  direction: Direction,
  reporter: Reporter,
  requestProtocol?: string,
  quantiles?: Array<string>,
  byLabels?: Array<string>
): Promise<Response<M.Metrics>> => {
  const data = nodeData(node);
  const options: IstioMetricsOptions = {
    queryTime: props.queryTime,
    duration: props.duration,
    step: props.step,
    rateInterval: props.rateInterval,
    filters: filters,
    quantiles: quantiles,
    byLabels: byLabels,
    direction: direction,
    reporter: reporter,
    requestProtocol: requestProtocol
  };

  switch (nodeMetricType) {
    case NodeMetricType.APP:
      return API.getAppMetrics(data.namespace, data.app, options);
    case NodeMetricType.SERVICE:
      return API.getServiceMetrics(data.namespace, data.service, options);
    case NodeMetricType.WORKLOAD:
      return API.getWorkloadMetrics(data.namespace, data.workload, options);
    default:
      return Promise.reject(new Error(`Unknown NodeMetricType: ${nodeMetricType}`));
  }
};

export const mergeMetricsResponses = (promises: Promise<Response<M.Metrics>>[]): Promise<Response<M.Metrics>> => {
  return Promise.all(promises).then(responses => {
    const metrics: M.Metrics = {
      metrics: {},
      histograms: {}
    };
    responses.forEach(r => {
      Object.keys(r.data.metrics).forEach(k => {
        metrics.metrics[k] = r.data.metrics[k];
      });
      Object.keys(r.data.histograms).forEach(k => {
        metrics.histograms[k] = r.data.histograms[k];
      });
    });
    return {
      data: metrics
    };
  });
};

export const getDatapoints = (
  mg: M.MetricGroup,
  title: string,
  comparator?: (metric: Metric, protocol?: Protocol) => boolean,
  protocol?: Protocol
): [string | number][] => {
  let series: M.TimeSeries[] = [];
  if (mg && mg.matrix) {
    const tsa: M.TimeSeries[] = mg.matrix;
    if (comparator) {
      for (let i = 0; i < tsa.length; ++i) {
        const ts = tsa[i];
        if (comparator(ts.metric, protocol)) {
          series.push(ts);
        }
      }
    } else {
      series = mg.matrix;
    }
  }
  return graphUtils.toC3Columns(series, title);
};

export const renderLabels = (data: NodeData) => {
  const hasNamespace =
    data.nodeType !== NodeType.UNKNOWN && !(data.nodeType === NodeType.SERVICE && data.isServiceEntry);
  const hasVersion = hasNamespace && data.version;
  return (
    <>
      <div className="label-collection" style={{ paddingTop: '3px' }}>
        {hasNamespace && <Label name="namespace" value={data.namespace} />}
        {hasVersion && <Label name={serverConfig.istioLabels.versionLabelName} value={data.version} />}
      </div>
    </>
  );
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
