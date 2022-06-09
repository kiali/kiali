import * as React from 'react';
import { NodeType, GraphNodeData, DestService, BoxByType, CLUSTER_DEFAULT } from '../../types/Graph';
import { CyNode, decoratedNodeData } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';
import { Badge, PopoverPosition } from '@patternfly/react-core';
import { Health } from 'types/Health';
import { HealthIndicator } from 'components/Health/HealthIndicator';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import KialiPageLink from 'components/Link/KialiPageLink';
import { serverConfig } from 'config';

interface LinkInfo {
  link: string;
  displayName: string;
  key: string;
}

const getTooltip = (tooltip: React.ReactFragment, nodeData: GraphNodeData): React.ReactFragment => {
  const addNamespace = nodeData.isBox !== BoxByType.NAMESPACE;
  const addCluster =
    nodeData.isBox !== BoxByType.CLUSTER &&
    nodeData.cluster !== CLUSTER_DEFAULT &&
    serverConfig?.clusterInfo?.name !== nodeData.cluster;
  return (
    <div style={{ textAlign: 'left' }}>
      <span>{tooltip}</span>
      {addNamespace && <div>{`Namespace: ${nodeData.namespace}`}</div>}
      {addCluster && <div>{`Cluster: ${nodeData.cluster}`}</div>}
    </div>
  );
};

export const getBadge = (nodeData: GraphNodeData, nodeType?: NodeType) => {
  switch (nodeType || nodeData.nodeType) {
    case NodeType.AGGREGATE:
      return (
        <PFBadge
          badge={PFBadges.Operation}
          size="sm"
          tooltip={getTooltip(`Operation: ${nodeData.aggregate!}`, nodeData)}
        />
      );
    case NodeType.APP:
      return <PFBadge badge={PFBadges.App} size="sm" tooltip={getTooltip(PFBadges.App.tt!, nodeData)} />;
    case NodeType.BOX:
      switch (nodeData.isBox) {
        case BoxByType.APP:
          return <PFBadge badge={PFBadges.App} size="sm" tooltip={getTooltip(PFBadges.App.tt!, nodeData)} />;
        case BoxByType.CLUSTER:
          return <PFBadge badge={PFBadges.Cluster} size="sm" tooltip={getTooltip(PFBadges.Cluster.tt!, nodeData)} />;
        case BoxByType.NAMESPACE:
          return (
            <PFBadge badge={PFBadges.Namespace} size="sm" tooltip={getTooltip(PFBadges.Namespace.tt!, nodeData)} />
          );
        default:
          return <PFBadge badge={PFBadges.Unknown} size="sm" />;
      }
    case NodeType.SERVICE:
      return !!nodeData.isServiceEntry ? (
        <PFBadge
          badge={PFBadges.ServiceEntry}
          size="sm"
          tooltip={getTooltip(
            nodeData.isServiceEntry.location === 'MESH_EXTERNAL' ? 'External Service Entry' : 'Internal Service Entry',
            nodeData
          )}
        />
      ) : (
        <PFBadge badge={PFBadges.Service} size="sm" tooltip={getTooltip(PFBadges.Service.tt!, nodeData)} />
      );
    case NodeType.WORKLOAD:
      return nodeData.hasWorkloadEntry ? (
        <PFBadge badge={PFBadges.WorkloadEntry} size="sm" tooltip={getTooltip(PFBadges.WorkloadEntry.tt!, nodeData)} />
      ) : (
        <PFBadge badge={PFBadges.Workload} size="sm" tooltip={getTooltip(PFBadges.Workload.tt!, nodeData)} />
      );
    default:
      return <PFBadge badge={PFBadges.Unknown} size="sm" />;
  }
};

export const getLink = (nodeData: GraphNodeData, nodeType?: NodeType, linkGenerator?: () => LinkInfo) => {
  const { app, cluster, namespace, service, workload } = nodeData;
  if (!nodeType || nodeData.nodeType === NodeType.UNKNOWN) {
    nodeType = nodeData.nodeType;
  }
  let displayName: string = 'unknown';
  let link: string | undefined;
  let key: string | undefined;

  if (linkGenerator) {
    ({ displayName, link, key } = linkGenerator());
  } else {
    switch (nodeType) {
      case NodeType.AGGREGATE:
        displayName = nodeData.aggregateValue!;
        break;
      case NodeType.APP:
        link = `/namespaces/${encodeURIComponent(namespace)}/applications/${encodeURIComponent(app!)}`;
        key = `${namespace}.app.${app}`;
        displayName = app!;
        break;
      case NodeType.BOX:
        switch (nodeData.isBox) {
          case BoxByType.APP:
            link = `/namespaces/${encodeURIComponent(namespace)}/applications/${encodeURIComponent(app!)}`;
            key = `${namespace}.app.${app}`;
            displayName = app!;
            break;
          case BoxByType.CLUSTER:
            displayName = cluster;
            break;
          case BoxByType.NAMESPACE:
            displayName = namespace;
            break;
        }
        break;
      case NodeType.SERVICE:
        if (nodeData.isServiceEntry) {
          link = `/namespaces/${encodeURIComponent(
            nodeData.isServiceEntry.namespace
          )}/istio/serviceentries/${encodeURIComponent(service!)}`;
        } else {
          link = `/namespaces/${encodeURIComponent(namespace)}/services/${encodeURIComponent(service!)}`;
        }
        key = `${namespace}.svc.${service}`;
        displayName = service!;
        break;
      case NodeType.WORKLOAD:
        link = `/namespaces/${encodeURIComponent(namespace)}/workloads/${encodeURIComponent(workload!)}`;
        key = `${namespace}.wl.${workload}`;
        displayName = workload!;
        break;
      default:
        // NOOP
        break;
    }
  }

  if (link && !nodeData.isInaccessible) {
    return (
      <KialiPageLink key={key} href={link} cluster={cluster}>
        {displayName}
      </KialiPageLink>
    );
  }

  return <span key={key}>{displayName}</span>;
};

export const renderBadgedHost = (host: string) => {
  return (
    <div>
      <PFBadge badge={PFBadges.Host} size="sm" />
      {host === '*' ? '* (all hosts)' : host}
    </div>
  );
};

export const renderBadgedName = (nodeData: GraphNodeData, label?: string) => {
  return (
    <div>
      <span style={{ marginRight: '1em', marginBottom: '3px', display: 'inline-block' }}>
        {label && (
          <span style={{ whiteSpace: 'pre' }}>
            <b>{label}</b>
          </span>
        )}
        {getBadge(nodeData)}
        {getLink({ ...nodeData, isInaccessible: true })}
      </span>
    </div>
  );
};

export const renderBadgedLink = (
  nodeData: GraphNodeData,
  nodeType?: NodeType,
  label?: string,
  linkGenerator?: () => LinkInfo
) => {
  const link = getLink(nodeData, nodeType, linkGenerator);

  return (
    <div>
      <span style={{ marginRight: '1em', marginBottom: '3px', display: 'inline-block' }}>
        {label && (
          <span style={{ whiteSpace: 'pre' }}>
            <b>{label}</b>
          </span>
        )}
        {getBadge(nodeData, nodeType)}
        {link}
      </span>
      {nodeData.isInaccessible && <KialiIcon.MtlsLock />}
    </div>
  );
};

export const renderHealth = (health?: Health) => {
  return (
    <>
      <Badge style={{ fontWeight: 'normal', marginTop: '4px', marginBottom: '4px' }} isRead={true}>
        <span style={{ margin: '3px 3px 1px 0' }}>
          {health ? (
            <HealthIndicator id="graph-health-indicator" health={health} tooltipPlacement={PopoverPosition.left} />
          ) : (
            'n/a'
          )}
        </span>
        health
      </Badge>
    </>
  );
};

export const renderDestServicesLinks = (node: any) => {
  const nodeData = decoratedNodeData(node);
  const destServices: DestService[] = node.data(CyNode.destServices);

  const links: any[] = [];
  if (!destServices) {
    return links;
  }

  destServices.forEach(ds => {
    const serviceNodeData: GraphNodeData = {
      id: nodeData.id,
      app: '',
      cluster: ds.cluster,
      isInaccessible: nodeData.isInaccessible,
      isOutside: nodeData.isOutside,
      isRoot: nodeData.isRoot,
      isServiceEntry: nodeData.isServiceEntry,
      namespace: nodeData.isServiceEntry ? nodeData.isServiceEntry.namespace : nodeData.namespace,
      nodeType: NodeType.SERVICE,
      service: ds.name,
      version: '',
      workload: ''
    };
    links.push(renderBadgedLink(serviceNodeData));
  });

  return links;
};
