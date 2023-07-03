import { NodeType, BoxByType } from '../../types/Graph';

export type GraphSelector = string;

interface GraphElementData {
  aggregate?: string;
  aggregateValue?: string;
  app?: string;
  id?: string;
  isBox?: BoxByType | null;
  namespace?: string;
  nodeType?: NodeType;
  service?: string;
  version?: string;
  workload?: string;
}

export class GraphSelectorBuilder {
  private data: GraphElementData = {};
  private clazz: string = '';

  aggregate(aggregate: string, aggregateValue: string) {
    this.data.aggregate = aggregate;
    this.data.aggregateValue = aggregateValue;
    return this;
  }

  app(app: string) {
    this.data.app = app;
    return this;
  }

  class(clazz: string) {
    this.clazz = '.' + clazz;
    return this;
  }

  id(id: string) {
    this.data.id = id;
    return this;
  }

  isBox(isBox: BoxByType | null) {
    this.data.isBox = isBox;
    return this;
  }

  namespace(namespace: string) {
    this.data.namespace = namespace;
    return this;
  }

  nodeType(nodeType: NodeType) {
    this.data.nodeType = nodeType;
    return this;
  }

  service(service: string) {
    this.data.service = service;
    return this;
  }

  version(version: string) {
    this.data.version = version;
    return this;
  }

  workload(workload: string) {
    this.data.workload = workload;
    return this;
  }

  build(): GraphSelector {
    return 'node' + this.clazz + this.buildDataSelector();
  }

  private buildDataSelector() {
    return Object.keys(this.data).reduce((dataSelector: string, key: string) => {
      return dataSelector + (this.data[key] == null ? `[!${key}]` : `[${key}="${this.data[key]}"]`);
    }, '');
  }
}
