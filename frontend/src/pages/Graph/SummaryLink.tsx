import * as React from 'react';
import {
  NodeType,
  GraphNodeData,
  DestService,
  BoxByType,
  CLUSTER_DEFAULT,
  DecoratedGraphNodeData
} from '../../types/Graph';
import { KialiIcon } from 'config/KialiIcon';
import { PopoverPosition } from '@patternfly/react-core';
import { Health } from 'types/Health';
import { HealthIndicator } from 'components/Health/HealthIndicator';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { homeCluster } from 'config';
import { KialiPageLink } from 'components/Link/KialiPageLink';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';

interface LinkInfo {
  displayName: string;
  key: string;
  link: string;
}

const badgeStyle = kialiStyle({
  display: 'inline-block',
  marginRight: '0.25rem',
  marginBottom: '0.25rem'
});

const getTooltip = (tooltip: React.ReactNode, nodeData: GraphNodeData): React.ReactNode => {
  const addNamespace = nodeData.isBox !== BoxByType.NAMESPACE;

  const addCluster =
    nodeData.isBox !== BoxByType.CLUSTER &&
    nodeData.cluster !== CLUSTER_DEFAULT &&
    homeCluster?.name !== nodeData.cluster;

  return (
    <div style={{ textAlign: 'left' }}>
      <span>{tooltip}</span>

      {addNamespace && <div>{`Namespace: ${nodeData.namespace}`}</div>}

      {addCluster && <div>{`Cluster: ${nodeData.cluster}`}</div>}
    </div>
  );
};

const addExtensionBadge = (nodeData: GraphNodeData, reactNode: React.ReactNode): React.ReactNode => {
  if (!nodeData.isExtension) {
    return reactNode;
  }

  const ext = nodeData.isExtension;
  const tt = (
    <div>
      {t('Extension')}: {ext.name}
    </div>
  );

  return (
    <span>
      <PFBadge badge={PFBadges.Extension} size="sm" tooltip={tt} />
      {reactNode}
    </span>
  );
};

export const getBadge = (nodeData: GraphNodeData, nodeType?: NodeType): React.ReactNode => {
  switch (nodeType ?? nodeData.nodeType) {
    case NodeType.AGGREGATE:
      return addExtensionBadge(
        nodeData,
        <PFBadge
          badge={PFBadges.Operation}
          size="sm"
          tooltip={getTooltip(`Operation: ${nodeData.aggregate!}`, nodeData)}
        />
      );
    case NodeType.APP:
      return addExtensionBadge(
        nodeData,
        <PFBadge badge={PFBadges.App} size="sm" tooltip={getTooltip(PFBadges.App.tt!, nodeData)} />
      );
    case NodeType.BOX:
      switch (nodeData.isBox) {
        case BoxByType.APP:
          return addExtensionBadge(
            nodeData,
            <PFBadge badge={PFBadges.App} size="sm" tooltip={getTooltip(PFBadges.App.tt!, nodeData)} />
          );
        case BoxByType.CLUSTER:
          return addExtensionBadge(
            nodeData,
            <PFBadge badge={PFBadges.Cluster} size="sm" tooltip={getTooltip(PFBadges.Cluster.tt!, nodeData)} />
          );
        case BoxByType.NAMESPACE:
          return addExtensionBadge(
            nodeData,
            <PFBadge badge={PFBadges.Namespace} size="sm" tooltip={getTooltip(PFBadges.Namespace.tt!, nodeData)} />
          );
        default:
          return addExtensionBadge(nodeData, <PFBadge badge={PFBadges.Unknown} size="sm" />);
      }
    case NodeType.SERVICE:
      return addExtensionBadge(
        nodeData,
        !!nodeData.isServiceEntry ? (
          <PFBadge
            badge={PFBadges.ServiceEntry}
            size="sm"
            tooltip={getTooltip(
              nodeData.isServiceEntry.location === 'MESH_EXTERNAL'
                ? 'External Service Entry'
                : 'Internal Service Entry',
              nodeData
            )}
          />
        ) : (
          <PFBadge badge={PFBadges.Service} size="sm" tooltip={getTooltip(PFBadges.Service.tt!, nodeData)} />
        )
      );
    case NodeType.WORKLOAD:
      return addExtensionBadge(
        nodeData,
        nodeData.hasWorkloadEntry ? (
          <PFBadge
            badge={PFBadges.WorkloadEntry}
            size="sm"
            tooltip={getTooltip(PFBadges.WorkloadEntry.tt!, nodeData)}
          />
        ) : (
          <PFBadge badge={PFBadges.Workload} size="sm" tooltip={getTooltip(PFBadges.Workload.tt!, nodeData)} />
        )
      );
    default:
      return addExtensionBadge(nodeData, <PFBadge badge={PFBadges.Unknown} size="sm" />);
  }
};

export const getLink = (
  nodeData: GraphNodeData,
  nodeType?: NodeType,
  linkGenerator?: () => LinkInfo
): React.ReactNode => {
  const { app, cluster, namespace, service, workload } = nodeData;

  if (!nodeType || nodeData.nodeType === NodeType.UNKNOWN) {
    nodeType = nodeData.nodeType;
  }

  let displayName = t('unknown');
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

  let extLink;
  if (nodeData.isExtension?.url) {
    const ext = nodeData.isExtension;
    const text = link && !nodeData.isInaccessible ? `, ` : `${displayName} `;
    extLink = (
      <a
        id={`extLink_${ext.name}`}
        title={`View in ${ext.name} UI`}
        href={ext.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {text}
        <ExternalLinkAltIcon />
      </a>
    );
  }

  if (link && !nodeData.isInaccessible) {
    return (
      <>
        <KialiPageLink key={key} href={link} cluster={cluster}>
          {displayName}
        </KialiPageLink>
        {extLink}
      </>
    );
  }

  return extLink ? extLink : <span key={key}>{displayName}</span>;
};

export const renderBadgedHost = (host: string): React.ReactNode => {
  return (
    <div>
      <PFBadge key={`badgedHost-${host}`} badge={PFBadges.Host} size="sm" />
      {host === '*' ? '* (all hosts)' : host}
    </div>
  );
};

export const renderBadgedName = (nodeData: GraphNodeData, label?: string): React.ReactNode => {
  return (
    <div key={`badgedName-${nodeData.id}`}>
      <span className={badgeStyle}>
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
  linkGenerator?: () => LinkInfo,
  style?: string
): React.ReactNode => {
  const link = getLink(nodeData, nodeType, linkGenerator);

  return (
    <div key={`node-${nodeData.id}`} className={style}>
      <span className={badgeStyle}>
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

export const renderHealth = (health?: Health): React.ReactNode => {
  return (
    <span>
      {health ? (
        <HealthIndicator id="graph-health-indicator" health={health} tooltipPlacement={PopoverPosition.left} />
      ) : (
        'N/A'
      )}
    </span>
  );
};

export const renderDestServicesLinks = (nodeData: DecoratedGraphNodeData): React.ReactNode[] => {
  const destServices: DestService[] | undefined = nodeData.destServices;

  const links: React.ReactNode[] = [];
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
