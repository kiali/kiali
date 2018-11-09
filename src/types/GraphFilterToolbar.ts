import { DurationInSeconds } from './Common';
import Namespace from './Namespace';
import { GraphType, GraphParamsType, NodeParamsType } from './Graph';
import { EdgeLabelMode } from './GraphFilter';

export default interface GraphFilterToolbarType extends GraphParamsType {
  activeNamespace: Namespace;
  duration: DurationInSeconds;
  isLoading: boolean;
  showSecurity: boolean;
  showUnusedNodes: boolean;
  // functions
  fetchGraphData: (
    namespace: Namespace,
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
