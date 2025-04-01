import { Controller } from '@patternfly/react-topology';
import { KialiDispatch } from '../types/Redux';
import { GraphActions } from './GraphActions';

export const GraphThunkActions = {
  graphReady: (controller: Controller) => {
    return (dispatch: KialiDispatch) => {
      dispatch(
        GraphActions.updateSummary({
          summaryType: 'graph',
          summaryTarget: controller
        })
      );
    };
  }
};
