import { Link } from 'react-router-dom';
import * as React from 'react';

import { NodeType, SummaryPanelPropType } from '../../types/Graph';
import { Health, healthNotAvailable } from '../../types/Health';

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

export const nodeData = (node: any) => {
  return {
    namespace: node.data('namespace'),
    app: node.data('app'),
    version: node.data('version'),
    workload: node.data('workload')
  };
};

export const nodeTypeToString = (nodeType: string) => {
  if (nodeType === NodeType.APP) {
    return 'Application';
  }

  if (nodeType === NodeType.UNKNOWN) {
    return 'Service';
  }

  return nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
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
