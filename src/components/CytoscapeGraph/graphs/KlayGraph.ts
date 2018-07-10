import { GraphType } from './GraphType';

export class KlayGraph implements GraphType {
  static getLayout() {
    return {
      name: 'klay',
      animate: false,
      nodeDimensionsIncludeLabels: true
    };
  }
}
