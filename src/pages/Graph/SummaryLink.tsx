import * as React from 'react';
import { Link } from 'react-router-dom';
import { NodeType, DecoratedGraphNodeData, GraphNodeData } from '../../types/Graph';
import { CyNode, decoratedNodeData } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';
import { Tooltip, Badge, PopoverPosition } from '@patternfly/react-core';
import { Health } from 'types/Health';
import { HealthIndicator, DisplayMode } from 'components/Health/HealthIndicator';

const getTitle = (nodeData: DecoratedGraphNodeData) => {
  switch (nodeData.nodeType) {
    case NodeType.APP:
      return (
        <Tooltip content={<>Application</>}>
          <Badge className="virtualitem_badge_definition">A</Badge>
        </Tooltip>
      );
    case NodeType.SERVICE:
      return !!nodeData.isServiceEntry ? (
        <Tooltip
          content={
            <>{nodeData.isServiceEntry === 'MESH_EXTERNAL' ? 'External Service Entry' : 'Internal Service Entry'}</>
          }
        >
          <Badge className="virtualitem_badge_definition">SE</Badge>
        </Tooltip>
      ) : (
        <Tooltip content={<>Service</>}>
          <Badge className="virtualitem_badge_definition">S</Badge>
        </Tooltip>
      );
    case NodeType.WORKLOAD:
      return (
        <Tooltip content={<>Workload</>}>
          <Badge className="virtualitem_badge_definition">W</Badge>
        </Tooltip>
      );
    default:
      return (
        <Tooltip content={<>Unknown</>}>
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

export const renderTitle = (nodeData: DecoratedGraphNodeData, health?: Health) => {
  const link = getLink(nodeData);

  return (
    <span>
      <span style={{ paddingRight: '0.5em' }}>
        {getTitle(nodeData)}
        {link}
      </span>
      {nodeData.isInaccessible && <KialiIcon.MtlsLock />}
      {health && (
        <HealthIndicator
          id="graph-health-indicator"
          mode={DisplayMode.SMALL}
          health={health}
          tooltipPlacement={PopoverPosition.left}
        />
      )}
    </span>
  );
};

export const renderDestServicesLinks = (node: any) => {
  const nodeData = decoratedNodeData(node);
  const destServices = node.data(CyNode.destServices);

  const links: any[] = [];
  if (!destServices) {
    return links;
  }

  destServices.forEach((ds, index) => {
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
    links.push(<RenderLink key={`service-${index}`} nodeData={serviceNodeData} nodeType={NodeType.SERVICE} />);
    links.push(<span key={`comma-after-${ds.name}`}>, </span>);
  });

  if (links.length > 0) {
    links.pop();
  }

  return links;
};
