import { GraphType } from './GraphType';

export class BreadthFirstGraph implements GraphType {
  static getLayout() {
    return {
      name: 'breadthfirst',
      directed: 'true',
      maximalAdjustments: 2,
      spacingFactor: 1
    };
  }
}
