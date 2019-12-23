import { PopoverPosition } from '@patternfly/react-core';
import { TourStopInfo, TourInfo } from 'components/Tour/TourStop';

export const GraphTourStops: { [name: string]: TourStopInfo } = {
  Display: {
    name: 'Display',
    description: 'Toggle various display options such as badging traffic animation, and service nodes.'
  },
  EdgeLabels: {
    name: 'Edge Labels',
    description:
      'Select the information to show on the edges between nodes. Response times reflect the 95th percentile.'
  },
  Find: {
    name: 'Find and Hide',
    description: 'Highlight or Hide graph elements via typed expressions. Click the Find/Hide help icon for details.',
    position: PopoverPosition.bottom
  },
  Graph: {
    name: 'Graph',
    description:
      "Single click a node to see its summary and emphasize its end-to-end paths. Double click a node to see a graph focused on that node.\nDouble click an 'external namespace' node to navigate directly to the namespace in the node's text label.",
    position: PopoverPosition.auto,
    offset: '0, -350'
  },
  ContextualMenu: {
    name: 'Contextual Menu',
    description:
      'Right click a node or an edge to see the contextual menu with links to details, traffic and inbound/outbound metrics for the node or edge.',
    position: PopoverPosition.auto,
    offset: '0, -350'
  },
  GraphType: {
    name: 'Graph Type',
    description:
      'Select a workload, service or application graph view. An application view can optionally be versioned and relies on app and version labeling. Workload and service graphs provide physical and logical views, respectively.',
    position: PopoverPosition.right
  },
  Layout: {
    name: 'Layout selection',
    description:
      'Select the graph layout for the mesh. Different layouts work best with different meshes. Find the layout that works best. Other buttons here provide zoom and fit-to-screen options.'
  },
  Legend: {
    name: 'Legend',
    description: 'Display the legend to learn about what the different shapes, colors and backgrounds mean.',
    position: PopoverPosition.top
  },
  Namespaces: {
    name: 'Namespaces',
    description: 'Select the namespaces you want to see in the graph.',
    position: PopoverPosition.bottom
  }
};

const GraphTour: TourInfo = {
  name: 'GraphTour',
  stops: [
    GraphTourStops.Namespaces,
    GraphTourStops.GraphType,
    GraphTourStops.EdgeLabels,
    GraphTourStops.Display,
    GraphTourStops.Find,
    GraphTourStops.Graph,
    GraphTourStops.ContextualMenu,
    GraphTourStops.Layout,
    GraphTourStops.Legend
  ]
};

export default GraphTour;
