import type { ReactElement } from 'react';
import type { Node, NodeModel } from '@patternfly/react-topology';
import { icons } from 'config';
import type { IconType } from 'config/Icons';
import type { GraphSettings, NodeData } from 'pages/Graph/GraphElems';
import { setNodeAttachments } from 'pages/Graph/GraphElems';
import type { GraphNodeData } from 'types/Graph';
import { GraphType, NodeType } from 'types/Graph';
import { decorateGraphData } from '../GraphData';

const settings: GraphSettings = {
  activeNamespaces: [],
  edgeLabels: [],
  graphType: GraphType.WORKLOAD,
  showOutOfMesh: false,
  showSecurity: false,
  showVirtualServices: true,
  trafficRates: []
};

const baseNode: GraphNodeData = {
  cluster: 'cluster-default',
  hasCB: true,
  id: 'workload',
  namespace: 'bookinfo',
  nodeType: NodeType.WORKLOAD,
  workload: 'ratings-v1'
};

const attachmentCases: { name: string; flags: Partial<GraphNodeData>; icon: IconType }[] = [
  { name: 'Workload Entry', flags: { hasWorkloadEntry: [{ name: 'ratings-v1' }] }, icon: icons.istio.workloadEntry },
  { name: 'ingress waypoint', flags: { hasIngressWaypoint: true }, icon: icons.istio.waypoint }
];

describe('graph attachment refresh', () => {
  it.each(attachmentCases)('clears a removed $name while retaining active attachments', ({ flags, icon }) => {
    const previous = decorateGraphData({ nodes: [{ data: { ...baseNode, ...flags } }] }, 60);
    const data = previous.nodes![0].data as NodeData;
    const node = { getData: () => data } as Node<NodeModel>;
    const attachmentIcons = (): IconType[] =>
      ((data.attachments ?? []) as ReactElement<{ icon: IconType }>[]).map(attachment => attachment.props.icon);

    setNodeAttachments(node, settings);
    expect(attachmentIcons()).toContain(icon);
    expect(attachmentIcons()).toContain(icons.istio.circuitBreaker);

    // Graph updates merge into existing node data. Omitted server fields must
    // explicitly reset old values so their decorations disappear.
    const refreshed = decorateGraphData({ nodes: [{ data: { ...baseNode } }] }, 60);
    Object.assign(data, refreshed.nodes![0].data);
    setNodeAttachments(node, settings);

    expect(attachmentIcons()).toEqual([icons.istio.circuitBreaker]);
  });
});
