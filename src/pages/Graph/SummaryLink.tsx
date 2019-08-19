import * as React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from 'patternfly-react';
import { NodeType, DecoratedGraphNodeData, GraphNodeData } from '../../types/Graph';
import { CyNode, decoratedNodeData } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';

const getTitle = (nodeData: DecoratedGraphNodeData) => {
  if (nodeData.nodeType === NodeType.UNKNOWN) {
    return 'Traffic Source';
  }
  if (nodeData.nodeType === NodeType.SERVICE && nodeData.isServiceEntry !== undefined) {
    return nodeData.isServiceEntry === 'MESH_EXTERNAL' ? 'External Service Entry' : 'Internal Service Entry';
  }
  return nodeData.nodeType.charAt(0).toUpperCase() + nodeData.nodeType.slice(1);
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
        <Icon key="link-icon" name="private" type="pf" style={{ paddingLeft: '2px', width: '10px' }} />
      )}
    </>
  );
};

export const renderTitle = (nodeData: DecoratedGraphNodeData) => {
  const link = getLink(nodeData);

  return (
    <>
      <strong>{getTitle(nodeData)}:</strong> {link}{' '}
      {nodeData.isInaccessible && <Icon name="private" type="pf" style={{ paddingLeft: '2px', width: '10px' }} />}
    </>
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
