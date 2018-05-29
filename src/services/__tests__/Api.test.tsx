jest.mock('../Api');

const API = require('../Api');

describe('#GetNamespaces using Promises', () => {
  it('should load namespaces', () => {
    return API.getNamespaces().then(({ data }) => {
      expect(data).toBeDefined();
      expect(data).toBeInstanceOf(Array);
    });
  });
});

describe('#GetServices using Promises', () => {
  it('should load services of namespace', () => {
    return API.getServices('istio-system').then(({ data }) => {
      expect(data).toBeDefined();
      expect(data.namespace.name).toEqual('istio-system');
      expect(data.services).toBeDefined();
      expect(data.services).toBeInstanceOf(Array);
    });
  });
});

describe('#getGrafanaInfo using Promises', () => {
  it('should load the information about grafana', () => {
    return API.getGrafanaInfo().then(({ data }) => {
      expect(data).toBeDefined();
      expect(data.url).toBeDefined();
      expect(data.variablesSuffix).toBeDefined();
    });
  });
});

describe('#getJaegerInfo using Promises', () => {
  it('should load the information about jaeger', () => {
    return API.getGrafanaInfo().then(({ data }) => {
      expect(data).toBeDefined();
      expect(data.url).toBeDefined();
    });
  });
});

describe('#GetGraphElements using Promises', () => {
  it('should load service detail data', () => {
    return API.getGraphElements('ISTIO_SYSTEM', null).then(({ data }) => {
      expect(data).toBeDefined();
      expect(data.elements.nodes).toBeDefined();
      expect(data.elements.nodes).toBeInstanceOf(Array);
      expect(data.elements.edges).toBeDefined();
      expect(data.elements.edges).toBeInstanceOf(Array);
    });
  });
});

describe('#GetServiceDetail using Promises', () => {
  it('should load service detail data', () => {
    return API.getServiceDetail('istio-system', 'reviews').then(({ data }) => {
      expect(data).toBeDefined();
      expect(data.name).toEqual('reviews');
      expect(data.namespace.name).toEqual('istio-system');
      expect(data.labels).toBeInstanceOf(Object);
      expect(data.ports).toBeInstanceOf(Array);
      expect(data.endpoints).toBeInstanceOf(Array);
      expect(data.pods).toBeInstanceOf(Array);
      expect(data.routeRules).toBeInstanceOf(Array);
      expect(data.dependencies).toBeInstanceOf(Object);
    });
  });
});

describe('#GetIstioConfig using Promises', () => {
  it('should load istio config objects of namespace', () => {
    return API.getIstioConfig('bookinfo').then(({ data }) => {
      expect(data).toBeDefined();
      expect(data.namespace.name).toEqual('bookinfo');
      expect(data.rules).toBeDefined();
      expect(data.rules).toBeInstanceOf(Array);
    });
  });
});

describe('#GetIstioConfigDetail using Promises', () => {
  it('should load istio config detail data', () => {
    return API.getIstioConfigDetail('istio-system', 'promhttp').then(({ data }) => {
      expect(data).toBeDefined();
      expect(data.namespace.name).toEqual('istio-system');
      expect(data.rule.name).toEqual('promhttp');
      expect(data.rule.match).toEqual('context.protocol == "http"');
      expect(data.rule.actions).toBeInstanceOf(Array);
    });
  });
});

describe('#GetServiceValidations using Promises', () => {
  it('should load istio service validation data', () => {
    return API.getServiceValidations('bookinfo', 'reviews').then(({ data }) => {
      expect(data).toBeDefined();
      expect(data!['pod']).toBeDefined();
      expect(data!['routerule']).toBeDefined();
    });
  });
});
