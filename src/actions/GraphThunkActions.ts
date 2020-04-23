import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../store/Store';
import { GraphActions } from './GraphActions';
import { KialiAppAction } from './KialiAppAction';

const GraphThunkActions = {
  graphReady: (cyRef: any) => {
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
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
