import { GraphParamsType } from './Graph';

export default interface GraphFilterToolbarType extends GraphParamsType {
  isLoading: boolean;
  showSecurity: boolean;
  handleRefreshClick: () => void;
}
