import { NodeType } from '../../types/Graph';

export type CytoscapeGraphSelector = string;

interface CytoscapeElementData {
  aggregate?: string;
  aggregateValue?: string;
  app?: string;
  id?: string;
  isGroup?: string | null;
  namespace?: string;
  nodeType?: string;
  service?: string;
  version?: string;
  workload?: string;
}

export class CytoscapeGraphSelectorBuilder {
  private data: CytoscapeElementData = {};
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

  isGroup(isGroup: string | null) {
    this.data.isGroup = isGroup;
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

  build(): CytoscapeGraphSelector {
    return 'node' + this.clazz + this.buildDataSelector();
  }

  private buildDataSelector() {
    return Object.keys(this.data).reduce((dataSelector: string, key: string) => {
      return dataSelector + (this.data[key] == null ? `[!${key}]` : `[${key}="${this.data[key]}"]`);
    }, '');
  }
}
