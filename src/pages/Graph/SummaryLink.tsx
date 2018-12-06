import * as React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from 'patternfly-react';
import { NodeType } from '../../types/Graph';
import { nodeData, NodeData } from './SummaryPanelCommon';

export const nodeTypeToString = (nodeType: string) => {
  if (nodeType === NodeType.UNKNOWN) {
    return 'Traffic Source';
  }

  return nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
};

const isInaccessible = (data: NodeData): boolean => {
  return data.isInaccessible || data.isServiceEntry;
};

const getLink = (data: NodeData, nodeType?: NodeType) => {
  const namespace = data.namespace;
  if (!nodeType || data.nodeType === NodeType.UNKNOWN) {
    nodeType = data.nodeType;
  }
  let { app, service, workload } = data;
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
      if (!data.isServiceEntry) {
        link = `/namespaces/${encodeURIComponent(namespace)}/services/${encodeURIComponent(service)}`;
        key = `${namespace}.svc.${service}`;
      }
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
      <strong>{nodeTypeToString(data.nodeType)}:</strong> {link}{' '}
      {isInaccessible(data) && <Icon name="private" type="pf" style={{ paddingLeft: '2px', width: '10px' }} />}
    </>
  );
};

export const renderDestServicesLinks = (node: any) => {
  const data = nodeData(node);
  const destServices = node.data('destServices');

  let links: any[] = [];
  if (!destServices) {
    return links;
  }

  const serviceNodeData: NodeData = {
    app: '',
    hasParent: false,
    isInaccessible: data.isInaccessible,
    isOutsider: data.isOutsider,
    isRoot: data.isRoot,
    isServiceEntry: data.isServiceEntry,
    namespace: data.namespace,
    nodeType: NodeType.SERVICE,
    service: '',
    version: '',
    workload: ''
  };

  Object.keys(destServices).forEach(k => {
    serviceNodeData.service = k;
    links.push(<RenderLink key={k} data={serviceNodeData} />);
    links.push(<span key={`comma-after-${k}`}>, </span>);
  });

  if (links.length > 0) {
    links.pop();
  }

  return links;
};
