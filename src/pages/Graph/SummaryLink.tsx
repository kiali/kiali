import * as React from 'react';
import { Link } from 'react-router-dom';
import { NodeType, GraphNodeData, DestService } from '../../types/Graph';
import { CyNode, decoratedNodeData } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';
import { Tooltip, Badge, PopoverPosition, TooltipPosition } from '@patternfly/react-core';
import { Health } from 'types/Health';
import { HealthIndicator, DisplayMode } from 'components/Health/HealthIndicator';

const getBadge = (nodeData: GraphNodeData, nodeType?: NodeType) => {
  switch (nodeType || nodeData.nodeType) {
    case NodeType.AGGREGATE:
      return (
        <Tooltip position={TooltipPosition.auto} content={<>Operation: {nodeData.aggregate!}</>}>
          <Badge className="virtualitem_badge_definition">O</Badge>
        </Tooltip>
      );
    case NodeType.APP:
      return (
        <Tooltip position={TooltipPosition.auto} content={<>Application</>}>
          <Badge className="virtualitem_badge_definition">A</Badge>
        </Tooltip>
      );
    case NodeType.SERVICE:
      return !!nodeData.isServiceEntry ? (
        <Tooltip
          position={TooltipPosition.auto}
          content={
            <>{nodeData.isServiceEntry === 'MESH_EXTERNAL' ? 'External Service Entry' : 'Internal Service Entry'}</>
          }
        >
          <Badge className="virtualitem_badge_definition">SE</Badge>
        </Tooltip>
      ) : (
        <Tooltip position={TooltipPosition.auto} content={<>Service</>}>
          <Badge className="virtualitem_badge_definition">S</Badge>
        </Tooltip>
      );
    case NodeType.WORKLOAD:
      return (
        <Tooltip position={TooltipPosition.auto} content={<>Workload</>}>
          <Badge className="virtualitem_badge_definition">W</Badge>
        </Tooltip>
      );
    default:
      return (
        <Tooltip position={TooltipPosition.auto} content={<>Unknown</>}>
          <Badge className="virtualitem_badge_definition">U</Badge>
        </Tooltip>
      );
  }
};

const getLink = (nodeData: GraphNodeData, nodeType?: NodeType) => {
  const namespace = nodeData.namespace;
  if (!nodeType || nodeData.nodeType === NodeType.UNKNOWN) {
    nodeType = nodeData.nodeType;
  }
  const { app, service, workload } = nodeData;
  let displayName: string = 'unknown';
  let link: string | undefined;
  let key: string | undefined;

  switch (nodeType) {
    case NodeType.AGGREGATE:
      displayName = nodeData.aggregateValue!;
      break;
    case NodeType.APP:
      link = `/namespaces/${encodeURIComponent(namespace)}/applications/${encodeURIComponent(app!)}`;
      key = `${namespace}.app.${app}`;
      displayName = app!;
      break;
    case NodeType.SERVICE:
      if (nodeData.isServiceEntry) {
        link = `/namespaces/${encodeURIComponent(namespace)}/istio/serviceentries/${encodeURIComponent(service!)}`;
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

  if (link && !nodeData.isInaccessible) {
    return (
      <Link key={key} to={link}>
        {displayName}
      </Link>
    );
  }

  return <span key={key}>{displayName}</span>;
};

type RenderLinkProps = {
  nodeData: GraphNodeData;
  nodeType?: NodeType;
};

export const RenderLink = (props: RenderLinkProps) => {
  const link = getLink(props.nodeData, props.nodeType);

  return (
    <>
      {link}
      {props.nodeData.isInaccessible && (
        <span style={{ paddingLeft: '2px' }}>
          <KialiIcon.MtlsLock />
        </span>
      )}
    </>
  );
};

export const renderBadgedHost = (host: string) => {
  return (
    <span>
      <Tooltip content={<>Host</>}>
        <Badge className="virtualitem_badge_definition">H</Badge>
      </Tooltip>
      {host}
    </span>
  );
};

export const renderBadgedLink = (nodeData: GraphNodeData, nodeType?: NodeType, label?: string) => {
  const link = getLink(nodeData, nodeType);

  return (
    <>
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
    </>
  );
};

export const renderHealth = (health?: Health) => {
  return (
    <>
      <Badge style={{ fontWeight: 'normal', marginTop: '4px', marginBottom: '4px' }} isRead={true}>
        <span style={{ margin: '3px 0 1px 0' }}>
          {health ? (
            <HealthIndicator
              id="graph-health-indicator"
              mode={DisplayMode.SMALL}
              health={health}
              tooltipPlacement={PopoverPosition.left}
            />
          ) : (
            'n/a'
          )}
        </span>
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
      isInaccessible: nodeData.isInaccessible,
      isOutside: nodeData.isOutside,
      isRoot: nodeData.isRoot,
      isServiceEntry: nodeData.isServiceEntry,
      namespace: ds.namespace,
      nodeType: NodeType.SERVICE,
      service: ds.name,
      version: '',
      workload: ''
    };
    links.push(renderBadgedLink(serviceNodeData));
  });

  return links;
};
