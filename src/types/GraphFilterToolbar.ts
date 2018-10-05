import { GraphParamsType } from './Graph';

export default interface GraphFilterToolbarType extends GraphParamsType {
  isLoading: boolean;
  showSecurity: boolean;
  showUnusedNodes: boolean;
  handleRefreshClick: () => void;
}
