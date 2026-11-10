import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Node, NodeModel } from '@patternfly/react-topology';
import { NodeShape, SVGDefsProvider, TopologyQuadrant } from '@patternfly/react-topology';
import { icons, serverConfig } from 'config';
import * as I18nUtils from 'utils/I18nUtils';
import type { IconType } from 'config/Icons';
import { EdgeLabelMode, GraphLayout, GraphType, NodeType } from 'types/Graph';
import type { WaypointTrafficSplit } from 'types/WaypointTraffic';
import type { GraphSettings, NodeData } from '../GraphElems';
import { setNodeAttachments, setNodeLabel } from '../GraphElems';

type DecoratorProps = {
  icon: IconType;
  quadrant: TopologyQuadrant;
  tooltip: React.ReactNode;
};

const getAttachments = (
  flags: Partial<NodeData>,
  showVirtualServices = true,
  showOutOfMesh = false
): React.ReactElement<DecoratorProps>[] => {
  const data = { hasVS: {}, ...flags } as NodeData;
  const node = {
    getData: () => data,
    getDimensions: () => ({ width: 40, height: 40 }),
    getNodeShape: () => NodeShape.rhombus
  } as Node<NodeModel>;
  const settings: GraphSettings = {
    activeNamespaces: [],
    edgeLabels: [],
    graphType: GraphType.SERVICE,
    showOutOfMesh,
    showSecurity: false,
    showVirtualServices,
    trafficRates: []
  };

  setNodeAttachments(node, settings);

  return (data.attachments ?? []) as React.ReactElement<DecoratorProps>[];
};

const singleFeatureCases: { flags: Partial<NodeData>; icon: IconType; name: string }[] = [
  { name: 'fault injection', flags: { hasFaultInjection: true }, icon: icons.istio.faultInjection },
  { name: 'mirroring', flags: { hasMirroring: true }, icon: icons.istio.mirroring },
  { name: 'request timeout', flags: { hasRequestTimeout: true }, icon: icons.istio.requestTimeout },
  { name: 'HTTP traffic shifting', flags: { hasTrafficShifting: true }, icon: icons.istio.trafficShifting },
  { name: 'TCP traffic shifting', flags: { hasTCPTrafficShifting: true }, icon: icons.istio.trafficShifting },
  {
    name: 'HTTP and TCP traffic shifting',
    flags: { hasTrafficShifting: true, hasTCPTrafficShifting: true },
    icon: icons.istio.trafficShifting
  },
  { name: 'request routing', flags: {}, icon: icons.istio.requestRouting }
];

describe('setNodeAttachments VS features', () => {
  it.each(singleFeatureCases)('uses the feature icon and title for $name as primary', ({ flags, icon }) => {
    const attachments = getAttachments({ hasRequestRouting: true, ...flags });

    expect(attachments).toHaveLength(1);
    expect(attachments[0].props.icon).toBe(icon);
    expect(attachments[0].props.quadrant).toBe(TopologyQuadrant.lowerLeft);

    const { container } = render(<>{attachments[0].props.tooltip}</>);

    expect(screen.getByText(icon.text)).toBeInTheDocument();
    expect(screen.queryByText('Virtual Service')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getAllByText(icon.text)).toHaveLength(1);
    if (icon === icons.istio.requestRouting) {
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    } else {
      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(1);
      expect(within(items[0]).getByText('Request Routing')).toBeInTheDocument();
      expect(items[0].querySelector('svg')).not.toBeNull();
    }
  });

  it.each([
    { name: 'Traffic Shifting', flags: { hasRequestRouting: true, hasTrafficShifting: true } },
    { name: 'Request Routing', flags: { hasRequestRouting: true } }
  ])('shows $name when hovering the rendered single-feature decorator', async ({ name, flags }) => {
    const user = userEvent.setup();
    const attachments = getAttachments(flags);
    const { container } = render(
      <svg>
        <SVGDefsProvider>{attachments[0]}</SVGDefsProvider>
      </svg>
    );

    await user.hover(container.querySelector('.pf-topology__node__decorator')!);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(name);
    expect(tooltip).not.toHaveTextContent('Virtual Service');
    if (name === 'Traffic Shifting') {
      const items = within(tooltip).getAllByRole('listitem');
      expect(items).toHaveLength(1);
      expect(within(items[0]).getByText('Request Routing')).toBeInTheDocument();
    } else {
      expect(within(tooltip).queryByRole('list')).not.toBeInTheDocument();
    }
  });

  it.each([true, false])('groups multiple specific features with request routing set to %s', hasRequestRouting => {
    const attachments = getAttachments({ hasFaultInjection: true, hasMirroring: true, hasRequestRouting });

    expect(attachments).toHaveLength(1);
    expect(attachments[0].props.icon).toBe(icons.istio.virtualService);

    render(<>{attachments[0].props.tooltip}</>);

    expect(screen.getByText('Virtual Service')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(hasRequestRouting ? 3 : 2);
    expect(within(items[0]).getByText('Fault Injection')).toBeInTheDocument();
    expect(within(items[1]).getByText('Mirroring')).toBeInTheDocument();
    if (hasRequestRouting) {
      expect(within(items[2]).getByText('Request Routing')).toBeInTheDocument();
    } else {
      expect(screen.queryByText('Request Routing')).not.toBeInTheDocument();
    }
    items.forEach(item => expect(item.querySelector('svg')).not.toBeNull());
  });

  it('uses a specific feature even without request-routing metadata', () => {
    const attachments = getAttachments({ hasMirroring: true });

    expect(attachments).toHaveLength(1);
    expect(attachments[0].props.icon).toBe(icons.istio.mirroring);

    render(<>{attachments[0].props.tooltip}</>);
    expect(screen.getByText('Mirroring')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('omits the VS decorator when no features are detected', () => {
    expect(getAttachments({})).toHaveLength(0);
  });

  it('omits VS features when their display setting is off', () => {
    expect(getAttachments({ hasFaultInjection: true, hasRequestRouting: true }, false)).toHaveLength(0);
  });

  it('omits VS features when the node has no VS', () => {
    expect(getAttachments({ hasVS: undefined, hasFaultInjection: true, hasRequestRouting: true })).toHaveLength(0);
  });
});

describe('node attachment tooltip presentation', () => {
  let ambientEnabled: boolean;

  beforeEach(() => {
    ambientEnabled = serverConfig.ambientEnabled;
  });

  afterEach(() => {
    serverConfig.ambientEnabled = ambientEnabled;
    rstest.restoreAllMocks();
  });

  it.each([
    { title: 'Circuit Breaker', flags: { hasCB: true } },
    { title: 'Workload Entry', flags: { hasWorkloadEntry: [{ name: 'external-workload' }] } },
    { title: 'Waypoint Proxy', flags: { hasIngressWaypoint: true } },
    { title: 'Missing Sidecar', flags: { isOutOfMesh: true }, ambient: false },
    { title: 'Out of Mesh', flags: { isOutOfMesh: true }, ambient: true },
    { title: 'Request Timeout', flags: { hasRequestTimeout: true } }
  ])('shows an icon and title for $title', async ({ title, flags, ambient }) => {
    serverConfig.ambientEnabled = ambient ?? false;
    const user = userEvent.setup();
    const attachments = getAttachments(flags, true, true);
    const { container } = render(
      <svg>
        <SVGDefsProvider>{attachments[0]}</SVGDefsProvider>
      </svg>
    );

    await user.hover(container.querySelector('.pf-topology__node__decorator')!);

    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getByText(title)).toBeInTheDocument();
    expect(tooltip.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(within(tooltip).queryByRole('list')).not.toBeInTheDocument();
    if (ambient) {
      expect(tooltip).not.toHaveTextContent('Missing Sidecar');
    }
  });

  it('translates the default attachment title', async () => {
    rstest
      .spyOn(I18nUtils, 't')
      .mockImplementation(text => (text === 'Circuit Breaker' ? 'Translated Circuit Breaker' : text));
    const user = userEvent.setup();
    const attachments = getAttachments({ hasCB: true });
    const { container } = render(
      <svg>
        <SVGDefsProvider>{attachments[0]}</SVGDefsProvider>
      </svg>
    );

    await user.hover(container.querySelector('.pf-topology__node__decorator')!);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Translated Circuit Breaker');
  });
});

describe('waypoint node labels', () => {
  const namespaceSplit: WaypointTrafficSplit = {
    canary: { cluster: 'Kubernetes', name: 'waypoint-canary', namespace: 'bookinfo', role: 'canary' },
    canaryWeight: 30,
    configLevel: 'namespace',
    primary: { cluster: 'Kubernetes', name: 'waypoint', namespace: 'bookinfo', role: 'primary' },
    primaryWeight: 70
  };

  const makeSettings = (): GraphSettings => ({
    activeNamespaces: [{ cluster: 'Kubernetes', name: 'bookinfo', waypointTrafficSplit: namespaceSplit }],
    edgeLabels: [EdgeLabelMode.TRAFFIC_DISTRIBUTION],
    graphType: GraphType.WORKLOAD,
    showOutOfMesh: false,
    showSecurity: false,
    showVirtualServices: false,
    trafficRates: []
  });

  const makeNode = (workload: string, backendLabel?: string): NodeModel => ({
    data: {
      cluster: 'Kubernetes',
      isWaypoint: true,
      namespace: 'bookinfo',
      nodeType: NodeType.WORKLOAD,
      waypointCanaryLabel: backendLabel,
      workload
    } as NodeData,
    id: workload,
    type: 'node'
  });

  beforeEach(() => {
    rstest
      .spyOn(I18nUtils, 't')
      .mockImplementation((text, options) => text.replace('{{weight}}', String(options?.weight)));
  });

  afterEach(() => {
    rstest.restoreAllMocks();
  });

  it.each([
    { backendLabel: 'Primary 90%', workload: 'waypoint' },
    { backendLabel: 'Canary 10%', workload: 'waypoint-canary' },
    { backendLabel: 'Primary 0%', workload: 'waypoint' },
    { backendLabel: 'Canary 100%', workload: 'waypoint-canary' },
    { backendLabel: 'Primary 100%', workload: 'waypoint' },
    { backendLabel: 'Canary 0%', workload: 'waypoint-canary' }
  ])('keeps the effective $backendLabel instead of the namespace split', ({ backendLabel, workload }) => {
    const node = makeNode(workload, backendLabel);

    setNodeLabel(node, new Map(), makeSettings(), GraphLayout.Dagre);

    const role = backendLabel.startsWith('Primary') ? 'primary' : 'canary';
    const weight = backendLabel.match(/(\d+)%/)?.[1];
    expect((node.data as NodeData).secondaryLabel).toContain(weight ? `${role} ${weight}%` : role);
  });

  it.each([undefined, ''])('falls back to the namespace split when the backend label is %s', backendLabel => {
    const node = makeNode('waypoint-canary', backendLabel);

    setNodeLabel(node, new Map(), makeSettings(), GraphLayout.Dagre);

    expect((node.data as NodeData).secondaryLabel).toContain('canary 30%');
  });

  it('shows multiple traffic splits when several namespaces reference the gateway', () => {
    const sharedCanary = {
      cluster: 'Kubernetes',
      name: 'waypoint-canary',
      namespace: 'infra',
      role: 'canary' as const
    };
    const sharedPrimary = {
      cluster: 'Kubernetes',
      name: 'waypoint',
      namespace: 'infra',
      role: 'primary' as const
    };
    const splitA: WaypointTrafficSplit = {
      ...namespaceSplit,
      canary: sharedCanary,
      canaryWeight: 10,
      primary: sharedPrimary,
      primaryWeight: 90
    };
    const splitB: WaypointTrafficSplit = {
      ...namespaceSplit,
      canary: sharedCanary,
      canaryWeight: 30,
      primary: sharedPrimary,
      primaryWeight: 70
    };
    const settings = makeSettings();
    settings.activeNamespaces = [
      { cluster: 'Kubernetes', name: 'client-a', waypointTrafficSplit: splitA },
      { cluster: 'Kubernetes', name: 'client-b', waypointTrafficSplit: splitB }
    ];
    const node = makeNode('waypoint-canary');
    node.data = { ...(node.data as NodeData), namespace: 'infra' };

    setNodeLabel(node, new Map(), settings, GraphLayout.Dagre);

    expect((node.data as NodeData).secondaryLabel).toContain('canary multi-%');
  });

  it('keeps the effective role when toggling percentages without duplicating labels', () => {
    const node = makeNode('waypoint-canary', 'Canary 10%');
    const data = node.data as NodeData;
    const settings = makeSettings();

    setNodeLabel(node, new Map(), settings, GraphLayout.Dagre);
    expect(data.secondaryLabel).toContain('canary 10%');

    settings.edgeLabels = [];
    setNodeLabel(node, new Map(), settings, GraphLayout.Dagre);
    expect(data.secondaryLabel).toContain('canary');
    expect(data.secondaryLabel).not.toMatch(/\d+%/);

    settings.edgeLabels = [EdgeLabelMode.TRAFFIC_DISTRIBUTION];
    data.waypointCanaryLabel = 'Canary 20%';
    setNodeLabel(node, new Map(), settings, GraphLayout.Dagre);
    setNodeLabel(node, new Map(), settings, GraphLayout.Dagre);
    expect(data.secondaryLabel).toContain('canary 20%');
    expect(data.secondaryLabel?.match(/canary/g)).toHaveLength(1);
    expect(data.secondaryLabel).not.toMatch(/10%|30%/);
  });
});
