import { CytoscapeGraphSelectorBuilder } from '../CytoscapeGraphSelector';
import { NodeType, BoxByType } from '../../../types/Graph';

describe('CytoscapeGraphSelector test', () => {
  it('Generates selector for app', () => {
    const selector = new CytoscapeGraphSelectorBuilder().app('myapp').build();
    expect(selector).toEqual('node[app="myapp"]');
  });

  it('Generates selector for id', () => {
    const selector = new CytoscapeGraphSelectorBuilder().id('myid').build();
    expect(selector).toEqual('node[id="myid"]');
  });

  it('Generates selector for namespace', () => {
    const selector = new CytoscapeGraphSelectorBuilder().namespace('mynamespace').build();
    expect(selector).toEqual('node[namespace="mynamespace"]');
  });

  it('Generates selector for nodeType', () => {
    const selector = new CytoscapeGraphSelectorBuilder().nodeType(NodeType.APP).build();
    expect(selector).toEqual('node[nodeType="app"]');
  });

  it('Generates selector for service', () => {
    const selector = new CytoscapeGraphSelectorBuilder().service('myservice').build();
    expect(selector).toEqual('node[service="myservice"]');
  });

  it('Generates selector for version', () => {
    const selector = new CytoscapeGraphSelectorBuilder().version('myversion').build();
    expect(selector).toEqual('node[version="myversion"]');
  });

  it('Generates selector for workload', () => {
    const selector = new CytoscapeGraphSelectorBuilder().workload('myworkload').build();
    expect(selector).toEqual('node[workload="myworkload"]');
  });

  it('Generates selector for isBox', () => {
    const selector = new CytoscapeGraphSelectorBuilder().isBox(BoxByType.APP).build();
    expect(selector).toEqual('node[isBox="app"]');
  });

  it('Generates falsy selector for isBox', () => {
    const selector = new CytoscapeGraphSelectorBuilder().isBox(null).build();
    expect(selector).toEqual('node[!isBox]');
  });

  it('Generates selector for two properties', () => {
    const selector = new CytoscapeGraphSelectorBuilder().workload('myworkload').app('myapp').build();
    expect(selector).toEqual('node[workload="myworkload"][app="myapp"]');
  });

  it('Generates selector for multiple properties', () => {
    const selector = new CytoscapeGraphSelectorBuilder()
      .workload('myworkload')
      .id('myid')
      .version('myversion')
      .service('myservice')
      .build();
    expect(selector).toEqual('node[workload="myworkload"][id="myid"][version="myversion"][service="myservice"]');
  });
});
