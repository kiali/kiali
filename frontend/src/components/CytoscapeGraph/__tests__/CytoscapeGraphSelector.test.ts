import { GraphSelectorBuilder } from 'pages/Graph/GraphSelector';
import { NodeType, BoxByType } from '../../../types/Graph';

describe('GraphSelector test', () => {
  it('Generates selector for app', () => {
    const selector = new GraphSelectorBuilder().app('myapp').build();
    expect(selector).toEqual('node[app="myapp"]');
  });

  it('Generates selector for id', () => {
    const selector = new GraphSelectorBuilder().id('myid').build();
    expect(selector).toEqual('node[id="myid"]');
  });

  it('Generates selector for namespace', () => {
    const selector = new GraphSelectorBuilder().namespace('mynamespace').build();
    expect(selector).toEqual('node[namespace="mynamespace"]');
  });

  it('Generates selector for nodeType', () => {
    const selector = new GraphSelectorBuilder().nodeType(NodeType.APP).build();
    expect(selector).toEqual('node[nodeType="app"]');
  });

  it('Generates selector for service', () => {
    const selector = new GraphSelectorBuilder().service('myservice').build();
    expect(selector).toEqual('node[service="myservice"]');
  });

  it('Generates selector for version', () => {
    const selector = new GraphSelectorBuilder().version('myversion').build();
    expect(selector).toEqual('node[version="myversion"]');
  });

  it('Generates selector for workload', () => {
    const selector = new GraphSelectorBuilder().workload('myworkload').build();
    expect(selector).toEqual('node[workload="myworkload"]');
  });

  it('Generates selector for isBox', () => {
    const selector = new GraphSelectorBuilder().isBox(BoxByType.APP).build();
    expect(selector).toEqual('node[isBox="app"]');
  });

  it('Generates falsy selector for isBox', () => {
    const selector = new GraphSelectorBuilder().isBox(null).build();
    expect(selector).toEqual('node[!isBox]');
  });

  it('Generates selector for two properties', () => {
    const selector = new GraphSelectorBuilder().workload('myworkload').app('myapp').build();
    expect(selector).toEqual('node[workload="myworkload"][app="myapp"]');
  });

  it('Generates selector for multiple properties', () => {
    const selector = new GraphSelectorBuilder()
      .workload('myworkload')
      .id('myid')
      .version('myversion')
      .service('myservice')
      .build();
    expect(selector).toEqual('node[workload="myworkload"][id="myid"][version="myversion"][service="myservice"]');
  });
});
