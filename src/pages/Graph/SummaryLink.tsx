import * as React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from 'patternfly-react';
import { NodeType } from '../../types/Graph';
import { nodeData, NodeData } from './SummaryPanelCommon';
import { CyNode } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';

const getTitle = (data: NodeData) => {
  if (data.nodeType === NodeType.UNKNOWN) {
    return 'Traffic Source';
  }
  if (data.nodeType === NodeType.SERVICE && data.isServiceEntry !== undefined) {
    return data.isServiceEntry === 'MESH_EXTERNAL' ? 'External Service Entry' : 'Internal Service Entry';
  }
  return data.nodeType.charAt(0).toUpperCase() + data.nodeType.slice(1);
};

const isInaccessible = (data: NodeData): boolean => {
  return data.isInaccessible;
};

const getLink = (data: NodeData, nodeType?: NodeType) => {
  const namespace = data.namespace;
  if (!nodeType || data.nodeType === NodeType.UNKNOWN) {
    nodeType = data.nodeType;
  }
  const { app, service, workload } = data;
  let displayName: string = 'unknown';
  let link: string | undefined;
  let key: string | undefined;

  switch (nodeType) {
    case NodeType.APP:
      link = `/namespaces/${encodeURIComponent(namespace)}/applications/${encodeURIComponent(app)}`;
      key = `${namespace}.app.${app}`;
      displayName = app;
      break;
    case NodeType.SERVICE:
      if (data.isServiceEntry) {
        link = `/namespaces/${encodeURIComponent(namespace)}/istio/serviceentries/${encodeURIComponent(service)}`;
      } else {
        link = `/namespaces/${encodeURIComponent(namespace)}/services/${encodeURIComponent(service)}`;
      }
      key = `${namespace}.svc.${service}`;
      displayName = service;
      break;
    case NodeType.WORKLOAD:
      link = `/namespaces/${encodeURIComponent(namespace)}/workloads/${encodeURIComponent(workload)}`;
      key = `${namespace}.wl.${workload}`;
      displayName = workload;
      break;
    default:
      // NOOP
      break;
  }

  if (link && !isInaccessible(data)) {
    return (
      <Link key={key} to={link}>
        {displayName}
      </Link>
    );
  }

  return <span key={key}>{displayName}</span>;
};

type RenderLinkProps = {
  data: NodeData;
  nodeType?: NodeType;
};

export const RenderLink = (props: RenderLinkProps) => {
  const link = getLink(props.data, props.nodeType);

  return (
    <>
      {link}
      {isInaccessible(props.data) && (
        <Icon key="link-icon" name="private" type="pf" style={{ paddingLeft: '2px', width: '10px' }} />
      )}
    </>
  );
};

export const renderTitle = (data: NodeData) => {
  const link = getLink(data);

  return (
    <>
      <strong>{getTitle(data)}:</strong> {link}{' '}
      {isInaccessible(data) && <Icon name="private" type="pf" style={{ paddingLeft: '2px', width: '10px' }} />}
    </>
  );
};

export const renderDestServicesLinks = (node: any) => {
  const data = nodeData(node);
  const destServices = node.data(CyNode.destServices);

  const links: any[] = [];
  if (!destServices) {
    return links;
  }

  destServices.forEach((ds, index) => {
    const serviceNodeData: NodeData = {
      app: '',
      hasParent: false,
      isInaccessible: data.isInaccessible,
      isOutsider: data.isOutsider,
      isRoot: data.isRoot,
      isServiceEntry: data.isServiceEntry,
      namespace: ds.namespace,
      nodeType: NodeType.SERVICE,
      service: ds.name,
      version: '',
      workload: ''
    };
    links.push(<RenderLink key={`service-${index}`} data={serviceNodeData} nodeType={NodeType.SERVICE} />);
    links.push(<span key={`comma-after-${ds.name}`}>, </span>);
  });

  if (links.length > 0) {
    links.pop();
  }

  return links;
};
