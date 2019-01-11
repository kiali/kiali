import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../store/Store';
import { GraphActions } from './GraphActions';
import { KialiAppAction } from './KialiAppAction';
import { CyData } from '../types/Graph';

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
  },
  updateGraph: (cyData: CyData) => {
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
      dispatch(GraphActions.updateGraph(cyData));
    };
  }
};

export default GraphThunkActions;
