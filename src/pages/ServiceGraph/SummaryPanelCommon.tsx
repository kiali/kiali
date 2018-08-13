import { Link } from 'react-router-dom';
import * as React from 'react';
import { NodeType, SummaryPanelPropType } from '../../types/Graph';
import { Health, healthNotAvailable } from '../../types/Health';
import MetricsOptions from '../../types/MetricsOptions';
import * as API from '../../services/Api';
import { authentication } from '../../utils/Authentication';

export interface NodeData {
  namespace: string;
  app: string;
  version: string;
  workload: string;
  service: string;
  nodeType: NodeType;
  hasParent: boolean;
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
    namespace: node.data('namespace'),
    app: node.data('app'),
    version: node.data('version'),
    workload: node.data('workload'),
    nodeType: node.data('nodeType'),
    hasParent: !!node.data('parent'),
    service: node.data('service')
  };
};

export const nodeTypeToString = (nodeType: string) => {
  if (nodeType === NodeType.UNKNOWN) {
    return 'service';
  }

  return nodeType;
};

export const getServicesLinkList = (cyNodes: any) => {
  let namespace = '';
  if (cyNodes.data) {
    namespace = cyNodes.data('namespace');
  } else {
    namespace = cyNodes[0].data('namespace');
  }

  let services = new Set();
  let linkList: any[] = [];

  cyNodes.forEach(node => {
    if (node.data('destServices')) {
      Object.keys(node.data('destServices')).forEach(k => {
        services.add(k);
      });
    }
  });

  services.forEach(svc => {
    linkList.push(
      <span key={svc}>
        <Link to={`/namespaces/${namespace}/services/${svc}`}>{svc}</Link>
      </span>
    );
    linkList.push(', ');
  });
  if (linkList.length > 0) {
    linkList.pop();
  }

  return linkList;
};

export const getNodeMetricType = (node: any) => {
  const data = nodeData(node);
  if (data.nodeType === NodeType.WORKLOAD || (data.nodeType === NodeType.APP && data.hasParent)) {
    return NodeMetricType.WORKLOAD;
  } else if (data.nodeType === NodeType.APP) {
    return NodeMetricType.APP;
  } else if (data.nodeType === NodeType.SERVICE) {
    return NodeMetricType.SERVICE;
  }
  return undefined;
};

export const getNodeMetrics = (
  nodeMetricType: NodeMetricType,
  node: any,
  props: SummaryPanelPropType,
  filters: Array<string>,
  includeIstio?: boolean,
  byLabelsIn?: Array<string>
) => {
  // Determine if is by workload or by app
  const data = nodeData(node);

  const options: MetricsOptions = {
    queryTime: props.queryTime,
    duration: props.duration,
    step: props.step,
    rateInterval: props.rateInterval,
    includeIstio: includeIstio,
    filters: filters,
    byLabelsIn: byLabelsIn
  };

  switch (nodeMetricType) {
    case NodeMetricType.APP:
      return API.getAppMetrics(authentication(), data.namespace, data.app, options);
    case NodeMetricType.WORKLOAD:
      return API.getWorkloadMetrics(authentication(), data.namespace, data.workload, options);
    default:
      // Unreachable code, but tslint disagrees
      // https://github.com/palantir/tslint/issues/696
      return Promise.reject(new Error(`Unknown NodeMetricType: ${nodeMetricType}`));
  }
};

export const renderPanelTitle = node => {
  const { namespace, service, app, workload, nodeType } = nodeData(node);
  const displayName: string = nodeType === NodeType.UNKNOWN ? 'unknown' : app || workload || service;
  let link: string | undefined;
  let displaySpan: any;

  switch (nodeType) {
    case NodeType.SERVICE:
      link = `/namespaces/${namespace}/services/${service}`;
      break;
    case NodeType.WORKLOAD:
      // Not available yet.
      // link = `/namespaces/${namespace}/workloads/${service}`;
      break;
    default:
      // NOOP
      break;
  }

  if (link) {
    displaySpan = <Link to={link}>{displayName}</Link>;
  } else {
    displaySpan = displayName;
  }

  return (
    <>
      {nodeTypeToString(nodeType)}: {displaySpan}
    </>
  );
};
