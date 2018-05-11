import { GraphType } from './GraphType';

export class DagreGraph implements GraphType {
  static getLayout() {
    return {
      name: 'dagre'
    };
  }
}
