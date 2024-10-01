import { Controller } from '@patternfly/react-topology';
import { KialiDispatch } from '../types/Redux';
import { GraphActions } from './GraphActions';

export const GraphThunkActions = {
  graphReady: (cyRef: any) => {
    return (dispatch: KialiDispatch) => {
      dispatch(
        GraphActions.updateSummary({
          summaryType: 'graph',
          summaryTarget: cyRef
        })
      );
    };
  },
  graphPFReady: (controller: Controller) => {
    return (dispatch: KialiDispatch) => {
      dispatch(
        GraphActions.updateSummary({
          isPF: true,
          summaryType: 'graph',
          summaryTarget: controller
        })
      );
    };
  }
};
