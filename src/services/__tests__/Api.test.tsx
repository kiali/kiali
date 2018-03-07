jest.mock('../Api');

const API = require('../Api');

describe('#GetNamespaces using Promises', () => {
  it('should load namespaces', () => {
    return API.GetNamespaces().then(data => {
      expect(data).toBeDefined();
      expect(data).toBeInstanceOf(Array);
    });
  });
});

describe('#GetServices using Promises', () => {
  it('should load services of namespace', () => {
    return API.GetServices('istio-system').then(data => {
      expect(data).toBeDefined();
      expect(data.namespace.name).toEqual('istio-system');
      expect(data.services).toBeDefined();
      expect(data.services).toBeInstanceOf(Array);
    });
  });
});

describe('#getGrafanaInfo using Promises', () => {
  it('should load the information about grafana', () => {
    return API.getGrafanaInfo().then(data => {
      expect(data).toBeDefined();
      expect(data.url).toBeDefined();
      expect(data.variablesSuffix).toBeDefined();
    });
  });
});

describe('#GetGraphElements using Promises', () => {
  it('should load service detail data', () => {
    return API.GetGraphElements('istio-system', null).then(data => {
      expect(data).toBeDefined();
      expect(data.elements).toBeDefined();
      expect(data.elements.nodes).toBeDefined();
      expect(data.elements.nodes).toBeInstanceOf(Array);
      expect(data.elements.edges).toBeDefined();
      expect(data.elements.edges).toBeInstanceOf(Array);
    });
  });
});

describe('#GetServiceDetail using Promises', () => {
  it('should load service detail data', () => {
    return API.GetServiceDetail('istio-system', 'reviews').then(data => {
      expect(data).toBeDefined();
      expect(data.name).toEqual('reviews');
      expect(data.namespace.name).toEqual('istio-system');
      expect(data.labels).toBeInstanceOf(Object);
      expect(data.ports).toBeInstanceOf(Array);
      expect(data.endpoints).toBeInstanceOf(Array);
      expect(data.pods).toBeInstanceOf(Array);
      expect(data.route_rules).toBeInstanceOf(Array);
      expect(data.dependencies).toBeInstanceOf(Object);
    });
  });
});
