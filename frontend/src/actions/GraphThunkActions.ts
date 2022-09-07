import { KialiDispatch } from "../types/Redux";
import { GraphActions } from './GraphActions';

const GraphThunkActions = {
  graphReady: (cyRef: any) => {
    return (dispatch: KialiDispatch) => {
      dispatch(
        GraphActions.updateSummary({
          summaryType: 'graph',
          summaryTarget: cyRef
        })
      );
    };
  }
};

export default GraphThunkActions;
