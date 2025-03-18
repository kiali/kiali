import { router } from 'app/History';
import { BoxByType, DecoratedGraphNodeData, NodeType } from 'types/Graph';
import { TracingInfo } from 'types/TracingInfo';
import { isMultiCluster, Paths } from 'config';
import { isParentKiosk, kioskContextMenuAction } from '../../Kiosk/KioskActions';
type LinkParams = { cluster?: string; name: string; namespace: string; type: string };

const getLinkParamsForNode = (node: DecoratedGraphNodeData): LinkParams | undefined => {
  const namespace: string = node.isServiceEntry ? node.isServiceEntry.namespace : node.namespace;

  let cluster = node.cluster;
  let name: string | undefined = undefined;
  let type: string | undefined = undefined;

  switch (node.nodeType) {
    case NodeType.APP:
    case NodeType.BOX:
      // only app boxes have full context menus
      const isBox = node.isBox;

      if (!isBox || isBox === BoxByType.APP) {
        // Prefer workload links
        if (node.workload && node.parent) {
          name = node.workload;
          type = Paths.WORKLOADS;
        } else {
          type = Paths.APPLICATIONS;
          name = node.app;
        }
      }
      break;
    case NodeType.SERVICE:
      type = node.isServiceEntry ? Paths.SERVICEENTRIES : Paths.SERVICES;
      name = node.service;
      break;
    case NodeType.WORKLOAD:
      name = node.workload;
      type = Paths.WORKLOADS;
      break;
  }

  return type && name ? { namespace, type, name, cluster } : undefined;
};

const getTracingURL = (namespace: string, namespaceSelector: boolean, tracingURL: string, name?: string): string => {
  return `${tracingURL}/search?service=${name}${namespaceSelector ? `.${namespace}` : ''}`;
};

export type ContextMenuOption = {
  external?: boolean;
  target?: string;
  text: string;
  url: string;
};

export const clickHandler = (o: ContextMenuOption, kiosk: string): void => {
  if (o.external) {
    window.open(o.url, o.target);
  } else {
    if (isParentKiosk(kiosk)) {
      kioskContextMenuAction(o.url);
    } else {
      router.navigate(o.url);
    }
  }
};

export const getOptions = (node: DecoratedGraphNodeData, tracingInfo?: TracingInfo): ContextMenuOption[] => {
  if (node.isInaccessible) {
    return [];
  }

  const linkParams = getLinkParamsForNode(node);

  if (!linkParams) {
    return [];
  }

  return getOptionsFromLinkParams(linkParams, tracingInfo);
};

const getOptionsFromLinkParams = (linkParams: LinkParams, tracingInfo?: TracingInfo): ContextMenuOption[] => {
  const { namespace, type, name, cluster } = linkParams;

  let options: ContextMenuOption[] = [];
  let detailsPageUrl = `/namespaces/${namespace}/${type}/${name}`;
  let concat = '?';

  if (cluster && isMultiCluster) {
    detailsPageUrl += `?clusterName=${cluster}`;
    concat = '&';
  }

  options.push({ text: 'Details', url: detailsPageUrl });

  if (type !== Paths.SERVICEENTRIES) {
    options.push({ text: 'Traffic', url: `${detailsPageUrl}${concat}tab=traffic` });

    if (type === Paths.WORKLOADS) {
      options.push({ text: 'Logs', url: `${detailsPageUrl}${concat}tab=logs` });
    }

    options.push({
      text: 'Inbound Metrics',
      url: `${detailsPageUrl}${concat}tab=${type === Paths.SERVICES ? 'metrics' : 'in_metrics'}`
    });

    if (type !== Paths.SERVICES) {
      options.push({ text: 'Outbound Metrics', url: `${detailsPageUrl}${concat}tab=out_metrics` });
    }

    if (type === Paths.APPLICATIONS && tracingInfo && tracingInfo.enabled) {
      if (tracingInfo.integration) {
        options.push({ text: 'Traces', url: `${detailsPageUrl}${concat}tab=traces` });
      } else if (tracingInfo.url) {
        options.push({
          text: 'Show Traces',
          url: getTracingURL(namespace, tracingInfo.namespaceSelector, tracingInfo.url, name),
          external: true,
          target: '_blank'
        });
      }
    }
  }

  return options;
};
