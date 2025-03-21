import { PopoverPosition } from '@patternfly/react-core';
import { TourStopInfo, TourInfo } from 'components/Tour/TourStop';
import { t } from 'utils/I18nUtils';
import { GraphShortcuts } from './GraphToolbar/GraphShortcuts';

export const GraphTourStops: { [name: string]: TourStopInfo } = {
  ContextualMenu: {
    name: t('Contextual Menu'),
    description: t(
      'Right-click or click kebab menu on a node label for links to details, traffic, inbound/outbound metrics and node graph.'
    ),
    position: PopoverPosition.left,
    distance: 250
  },
  Display: {
    name: t('Display'),
    description: t(
      'Set edge labeling, node badging, and various display options. Response-time edge labeling, security badging, and traffic animation may affect performance. Response-times reflect the 95th percentile.'
    ),
    position: PopoverPosition.rightStart
  },
  Find: {
    name: t('Find and Hide'),
    description: t(
      'Highlight or Hide graph elements via typed expressions. Click the dropdown for preset Find or Hide expressions. Click the Find/Hide help icon for details on the expression language.'
    ),
    position: PopoverPosition.bottom
  },
  Graph: {
    name: t('Graph'),
    description: t('Click on a node or edge to see its summary and emphasize its end-to-end paths.'),
    position: PopoverPosition.left,
    distance: 250
  },
  GraphTraffic: {
    name: t('Graph Traffic'),
    description: t(
      'Choose the traffic rates used to generate the graph. Each supported protocol offers one or more options. Unused protocols can be omitted.'
    ),
    position: PopoverPosition.bottom
  },
  GraphType: {
    name: t('Graph Type'),
    description: t(
      'Select a workload, service or application graph view. An application view can optionally be versioned and relies on app and version labeling. Workload and service graphs provide physical and logical views, respectively.'
    ),
    position: PopoverPosition.right
  },
  Layout: {
    name: t('Layout selection'),
    description: t(
      'Select the graph layout for the mesh. Different layouts work best with different meshes. Find the layout that works best. Other buttons here provide zoom and fit-to-screen options.'
    ),
    position: PopoverPosition.right
  },
  Legend: {
    name: t('Legend'),
    description: t('Display the legend to learn about what the different shapes, colors and backgrounds mean.'),
    position: PopoverPosition.rightEnd
  },
  Namespaces: {
    name: t('Namespaces'),
    description: t('Select the namespaces you want to see in the graph.'),
    position: PopoverPosition.bottomStart
  },
  Shortcuts: {
    name: t('Shortcuts'),
    htmlDescription: GraphShortcuts,
    position: PopoverPosition.leftStart
  },
  SidePanel: {
    name: t('Side Panel'),
    description: t(
      'The Side Panel shows details about the currently selected node or edge, otherwise the whole graph.'
    ),
    position: PopoverPosition.left
  },
  TimeRange: {
    name: t('Time Range & Replay'),
    description: t(
      'Select how often to refresh the graph and how much historical metric data is used to build the graph, per refresh. For example "Last 5m" means use the most recent 5 minutes of request metric data.  To replay a historical time window click the replay icon.  This replaces the current time range controls with the replay toolbar.'
    ),
    position: PopoverPosition.bottomEnd
  }
};

export const GraphTour: TourInfo = {
  name: t('GraphTour'),
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
