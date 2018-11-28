import { DurationInSeconds } from './Common';
import Namespace from './Namespace';
import { GraphType, GraphParamsType, NodeParamsType } from './Graph';
import { EdgeLabelMode } from './GraphFilter';

export default interface GraphFilterToolbarType extends GraphParamsType {
  activeNamespaces: Namespace[];
  duration: DurationInSeconds;
  isLoading: boolean;
  showSecurity: boolean;
  showUnusedNodes: boolean;
  // functions
  fetchGraphData: (
    namespaces: Namespace[],
    duration: DurationInSeconds,
    graphType: GraphType,
    injectServiceNodes: boolean,
    edgeLabelMode: EdgeLabelMode,
    showSecurity: boolean,
    showUnusedNodes: boolean,
    node?: NodeParamsType
  ) => any;
  handleRefreshClick: () => void;
}
