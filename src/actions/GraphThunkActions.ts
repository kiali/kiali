import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../store/Store';
import { GraphActions } from './GraphActions';
import { KialiAppAction } from './KialiAppAction';

const GraphThunkActions = {
  graphRendered: (cy: any) => {
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
      dispatch(
        GraphActions.showSidePanelInfo({
          summaryType: 'graph',
          summaryTarget: cy
        })
      );
    };
  }
};

export default GraphThunkActions;
