import { MeshType } from 'types/Mesh';
import { KialiDispatch } from '../types/Redux';
import { MeshActions } from './MeshActions';
import { Controller } from '@patternfly/react-topology';

export const MeshThunkActions = {
  meshReady: (controller: Controller) => {
    return (dispatch: KialiDispatch): void => {
      dispatch(
        MeshActions.setTarget({
          elem: controller,
          type: MeshType.Mesh
        })
      );
    };
  }
};
