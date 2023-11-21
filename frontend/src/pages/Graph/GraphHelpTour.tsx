import { PopoverPosition } from '@patternfly/react-core';
import { TourStopInfo, TourInfo } from 'components/Tour/TourStop';
import { GraphShortcuts } from './GraphToolbar/GraphShortcuts';

export const GraphTourStops: { [name: string]: TourStopInfo } = {
  ContextualMenu: {
    name: $t('ContextualMenu', 'Contextual Menu'),
    description: $t(
      'description1',
      'Right-click a node or an edge to see the contextual menu with links to details, traffic and inbound/outbound metrics for the node or edge.'
    ),
    position: PopoverPosition.left,
    distance: 250
  },
  ContextualMenuPF: {
    name: $t('ContextualMenu', 'Contextual Menu'),
    description: $t(
      'description2',
      'Right-click a node to see the contextual menu with links to details, traffic, inbound/outbound metrics and node graph.'
    ),
    position: PopoverPosition.left,
    distance: 250
  },
  Display: {
    name: $t('Display'),
    description: $t(
      'description3',
      'Set edge labeling, node badging, and various display options. Response-time edge labeling, security badging, and traffic animation may affect performance. Response-times reflect the 95th percentile.'
    ),
    position: PopoverPosition.rightStart
  },
  Find: {
    name: $t('FindAndHide', 'Find and Hide'),
    description: $t(
      'description4',
      'Highlight or Hide graph elements via typed expressions. Click the dropdown for preset Find or Hide expressions. Click the Find/Hide help icon for details on the expression language.'
    ),
    position: PopoverPosition.bottom
  },
  Graph: {
    name: $t('Graph'),
    description: $t(
      'description5',
      "Click on a node or edge to see its summary and emphasize its end-to-end paths. Double-click a node to see a graph focused on that node.\nDouble-click an 'external namespace' node to navigate directly to the namespace in the node's text label. Shift-Drag to quickly zoom in."
    ),
    position: PopoverPosition.left,
    distance: 250
  },
  GraphPF: {
    name: $t('Graph'),
    description: $t('description6', 'Click on a node or edge to see its summary and emphasize its end-to-end paths.'),
    position: PopoverPosition.left,
    distance: 250
  },
  GraphTraffic: {
    name: $t('GraphTraffic', 'Graph Traffic'),
    description: $t(
      'description7',
      'Choose the traffic rates used to generate the graph. Each supported protocol offers one or more options. Unused protocols can be omitted.'
    ),
    position: PopoverPosition.bottom
  },
  GraphType: {
    name: $t('GraphType', 'Graph Type'),
    description: $t(
      'description8',
      'Select a workload, service or application graph view. An application view can optionally be versioned and relies on app and version labeling. Workload and service graphs provide physical and logical views, respectively.'
    ),
    position: PopoverPosition.right
  },
  Layout: {
    name: $t('LayoutSelection', 'Layout selection'),
    description: $t(
      'description9',
      'Select the graph layout for the mesh. Different layouts work best with different meshes. Find the layout that works best. Other buttons here provide zoom and fit-to-screen options.'
    ),
    position: PopoverPosition.right
  },
  Legend: {
    name: $t('Legend'),
    description: $t(
      'description10',
      'Display the legend to learn about what the different shapes, colors and backgrounds mean.'
    ),
    position: PopoverPosition.rightEnd
  },
  Namespaces: {
    name: $t('Namespaces'),
    description: $t('description11', 'Select the namespaces you want to see in the graph.'),
    position: PopoverPosition.bottomStart
  },
  Shortcuts: {
    name: $t('Shortcuts', 'Shortcuts and tips...'),
    htmlDescription: GraphShortcuts,
    position: PopoverPosition.leftStart
  },
  SidePanel: {
    name: $t('SidePanel', 'Side Panel'),
    description: $t(
      'description12',
      'The Side Panel shows details about the currently selected node or edge, otherwise the whole graph.'
    ),
    position: PopoverPosition.left
  },
  TimeRange: {
    name: $t('TimeRange&Replay', 'Time Range & Replay'),
    description: $t(
      'description13',
      "Select how often to refresh the graph and how much historical metric data is used to build the graph, per refresh. For example 'Last 5m' means use the most recent 5 minutes of request metric data.  To replay a historical time window click the replay icon.  This replaces the current time range controls with the replay toolbar."
    ),
    position: PopoverPosition.bottomEnd
  }
};

export const GraphTour: TourInfo = {
  name: $t('GraphTour'),
  stops: [
    GraphTourStops.Shortcuts,
    GraphTourStops.Namespaces,
    GraphTourStops.GraphTraffic,
    GraphTourStops.GraphType,
    GraphTourStops.Display,
    GraphTourStops.Find,
    GraphTourStops.TimeRange,
    GraphTourStops.Graph,
    GraphTourStops.ContextualMenu,
    GraphTourStops.SidePanel,
    GraphTourStops.Layout,
    GraphTourStops.Legend
  ]
};

export const GraphTourPF: TourInfo = {
  name: $t('GraphTour'),
  stops: [
    GraphTourStops.Shortcuts,
    GraphTourStops.Namespaces,
    GraphTourStops.GraphTraffic,
    GraphTourStops.GraphType,
    GraphTourStops.Display,
    GraphTourStops.Find,
    GraphTourStops.TimeRange,
    GraphTourStops.GraphPF,
    GraphTourStops.ContextualMenuPF,
    GraphTourStops.SidePanel,
    GraphTourStops.Layout,
    GraphTourStops.Legend
  ]
};
