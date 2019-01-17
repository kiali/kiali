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
  it('should load graph data', () => {
    return API.getGraphElements({ namespaces: 'ISTIO_SYSTEM' }).then(({ data }) => {
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
    return API.getServiceDetail('bookinfo', 'reviews', 'true').then(({ data }) => {
      expect(data).toBeDefined();
      expect(data.name).toEqual('reviews');
      expect(data.namespace.name).toEqual('bookinfo');
      expect(data.labels).toBeInstanceOf(Object);
      expect(data.ports).toBeInstanceOf(Array);
      expect(data.endpoints).toBeInstanceOf(Array);
      expect(data.pods).toBeInstanceOf(Array);
      expect(data.virtualServices.items).toBeInstanceOf(Array);
      expect(data.destinationRules.items).toBeInstanceOf(Array);
      expect(data.dependencies).toBeInstanceOf(Object);
      expect(data.validations).toBeInstanceOf(Object);
    });
  });
});

describe('#GetIstioConfig using Promises', () => {
  it('should load istio config objects of namespace', () => {
    return API.getIstioConfig('bookinfo', null, 'true').then(({ data }) => {
      expect(data).toBeDefined();
      expect(data.namespace.name).toEqual('bookinfo');
      expect(data.rules).toBeDefined();
      expect(data.rules).toBeInstanceOf(Array);
      expect(data.validations).toBeDefined();
      expect(data.validations.routerule).toBeDefined();
      expect(data.validations.destinationrule).toBeDefined();
      expect(data.validations.virtualservice).toBeDefined();
    });
  });
});

describe('#GetIstioConfigDetail using Promises', () => {
  it('should load istio config detail data', () => {
    return API.getIstioConfigDetail('istio-system', 'rules', 'promhttp', 'true').then(({ data }) => {
      expect(data).toBeDefined();
      expect(data.namespace.name).toEqual('istio-system');
      expect(data.rule.metadata.name).toEqual('promhttp');
      expect(data.rule.spec.match).toEqual('context.protocol == "http"');
      expect(data.rule.spec.actions).toBeInstanceOf(Array);
      expect(data.validation).toBeInstanceOf(Object);
    });
  });
});
