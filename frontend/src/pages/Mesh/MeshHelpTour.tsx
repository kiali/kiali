import { PopoverPosition } from '@patternfly/react-core';
import { TourStopInfo, TourInfo } from 'components/Tour/TourStop';
import { MeshShortcuts } from './toolbar/MeshShortcuts';
import { t } from 'utils/I18nUtils';

export const MeshTourStops: { [name: string]: TourStopInfo } = {
  ContextualMenu: {
    name: t('Contextual Menu'),
    description: t('Click kebab menu on a node label to see the contextual menu options for the node.'),
    position: PopoverPosition.left,
    distance: 250
  },
  Display: {
    name: t('Display'),
    description: t('Set display options for the mesh.'),
    position: PopoverPosition.rightStart
  },
  Find: {
    name: t('Find and Hide'),
    description: t(
      'Highlight or Hide mesh elements via typed expressions. Click the dropdown for preset Find or Hide expressions. Click the Find/Hide help icon for details on the expression language.'
    ),
    position: PopoverPosition.bottom
  },
  Layout: {
    name: t('Layout selection'),
    description: t(
      'Select the layout for the mesh. Different layouts work best with different meshes. Find the layout that works best. Other buttons here provide zoom and fit-to-screen options.'
    ),
    position: PopoverPosition.right
  },
  Legend: {
    name: t('Legend'),
    description: t('Display the legend to learn about what the different shapes, colors and backgrounds mean.'),
    position: PopoverPosition.rightEnd
  },
  Mesh: {
    name: t('Mesh'),
    description: t('Click on a node or edge to see its summary and emphasize its end-to-end paths.'),
    position: PopoverPosition.left,
    distance: 250
  },
  Shortcuts: {
    name: t('Shortcuts'),
    htmlDescription: MeshShortcuts,
    position: PopoverPosition.leftStart
  },
  TargetPanel: {
    name: t('Side Panel'),
    description: t('The Side Panel shows details about the currently selected node or edge, otherwise the whole mesh.'),
    position: PopoverPosition.left
  },
  TimeRange: {
    name: t('Time Range'),
    description: t(
      'Select how often to refresh the mesh and how much historical metric data is used for metric charts. For example "Last 5m" means use the most recent 5 minutes of request metric data.'
    ),
    position: PopoverPosition.bottomEnd
  }
};

export const MeshTour: TourInfo = {
  name: 'MeshTour',
  stops: [
    MeshTourStops.Shortcuts,
    // MeshTourStops.Display,
    MeshTourStops.Find,
    MeshTourStops.TimeRange,
    MeshTourStops.Mesh,
    MeshTourStops.TargetPanel,
    // MeshTourStops.ContextualMenu,
    MeshTourStops.Layout,
    MeshTourStops.Legend
  ]
};
