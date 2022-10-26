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
  graphPFReady: (controller: any) => {
    return (dispatch: KialiDispatch) => {
      dispatch(
        GraphActions.updateSummary({
          summaryType: 'graphPF',
          summaryTarget: controller
        })
      );
    };
  }
};
