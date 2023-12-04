import { MeshTarget } from 'types/Mesh';
import { KialiDispatch } from '../types/Redux';
import { MeshActions } from './MeshActions';
import { Visualization } from '@patternfly/react-topology';

export const MeshThunkActions = {
  meshReady: (controller: Visualization) => {
    return (dispatch: KialiDispatch) => {
      dispatch(
        MeshActions.setTarget({
          elem: controller,
          type: 'mesh'
        } as MeshTarget)
      );
    };
  }
};
