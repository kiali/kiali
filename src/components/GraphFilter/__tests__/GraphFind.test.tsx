import * as React from 'react';
import { shallow } from 'enzyme';

import { GraphFind } from '../GraphFind';

const testHandler = () => {
  console.log('handled');
};

const testSetter = _val => {
  console.log('set');
};

// TODO Find out why typescript is unhappy and get rid of all of these ts-ignores
describe('Parse find value test', () => {
  it('should return the correct selector for raw find values', () => {
    const wrapper = shallow(
      <GraphFind
        cyData={{ updateTimestamp: 123, cyRef: 'dummyRef' }}
        findValue="testFind"
        hideValue="testHide"
        showFindHelp={false}
        setFindValue={testSetter}
        setHideValue={testSetter}
        toggleFindHelp={testHandler}
      />
    );

    const instance = wrapper.instance() as GraphFind;

    // check coverage of node operands
    // @ts-ignore
    expect(instance.parseValue('httpin > 5.0')).toEqual('node[httpIn > 5.0]');
    // @ts-ignore
    expect(instance.parseValue('httpout < 5.0')).toEqual('node[httpOut < 5.0]');
    // @ts-ignore
    expect(instance.parseValue('namespace = foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseValue('ns = foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseValue('node = app')).toEqual('node[nodeType = "app"]');
    // @ts-ignore
    expect(instance.parseValue('node = service')).toEqual('node[nodeType = "service"]');
    // @ts-ignore
    expect(instance.parseValue('node = svc')).toEqual('node[nodeType = "service"]');
    // @ts-ignore
    expect(instance.parseValue('node = unknown')).toEqual('node[nodeType = "unknown"]');
    // @ts-ignore
    expect(instance.parseValue('node = workload')).toEqual('node[nodeType = "workload"]');
    // @ts-ignore
    expect(instance.parseValue('node = wl')).toEqual('node[nodeType = "workload"]');
    // @ts-ignore
    expect(instance.parseValue('service = foo')).toEqual('node[service = "foo"]');
    // @ts-ignore
    expect(instance.parseValue('svc = foo')).toEqual('node[service = "foo"]');
    // @ts-ignore
    expect(instance.parseValue('version = foo')).toEqual('node[version = "foo"]');
    // @ts-ignore
    expect(instance.parseValue('tcpin > 5.0')).toEqual('node[tcpIn > 5.0]');
    // @ts-ignore
    expect(instance.parseValue('tcpout < 5.0')).toEqual('node[tcpOut < 5.0]');
    // @ts-ignore
    expect(instance.parseValue('workload = foo')).toEqual('node[workload = "foo"]');
    // @ts-ignore
    expect(instance.parseValue('wl = foo')).toEqual('node[workload = "foo"]');

    // @ts-ignore
    expect(instance.parseValue('circuitBreaker')).toEqual('node[?hasCB]');
    // @ts-ignore
    expect(instance.parseValue('cb')).toEqual('node[?hasCB]');
    // @ts-ignore
    expect(instance.parseValue('sidecar')).toEqual('node[^hasMissingSC]');
    // @ts-ignore
    expect(instance.parseValue('sc')).toEqual('node[^hasMissingSC]');
    // @ts-ignore
    expect(instance.parseValue('outside')).toEqual('node[?isOutside]');
    // @ts-ignore
    expect(instance.parseValue('outsider')).toEqual('node[?isOutside]');
    // @ts-ignore
    expect(instance.parseValue('root')).toEqual('node[?isRoot]');
    // @ts-ignore
    expect(instance.parseValue('trafficsource')).toEqual('node[?isRoot]');
    // @ts-ignore
    expect(instance.parseValue('virtualService')).toEqual('node[?hasVS]');
    // @ts-ignore
    expect(instance.parseValue('vs')).toEqual('node[?hasVS]');

    // check coverage of edge operands
    // @ts-ignore
    expect(instance.parseValue('grpc > 5.0')).toEqual('edge[grpc > 5.0]');
    // @ts-ignore
    expect(instance.parseValue('%grpcerror > 50')).toEqual('edge[grpcPercentErr > 50]');
    // @ts-ignore
    expect(instance.parseValue('%grpcerr > 50')).toEqual('edge[grpcPercentErr > 50]');
    // @ts-ignore
    expect(instance.parseValue('%grpctraffic > 50')).toEqual('edge[grpcPercentReq > 50]');
    // @ts-ignore
    expect(instance.parseValue('http > 5.0')).toEqual('edge[http > 5.0]');
    // @ts-ignore
    expect(instance.parseValue('%httperror > 50')).toEqual('edge[httpPercentErr > 50]');
    // @ts-ignore
    expect(instance.parseValue('%httperr > 50')).toEqual('edge[httpPercentErr > 50]');
    // @ts-ignore
    expect(instance.parseValue('%httptraffic > 50')).toEqual('edge[httpPercentReq > 50]');
    // @ts-ignore
    expect(instance.parseValue('responseTime > 5.0')).toEqual('edge[responseTime > 5.0]');
    // @ts-ignore
    expect(instance.parseValue('rt > 5.0')).toEqual('edge[responseTime > 5.0]');
    // @ts-ignore
    expect(instance.parseValue('tcp > 5.0')).toEqual('edge[tcp > 5.0]');

    // @ts-ignore
    expect(instance.parseValue('mtls')).toEqual('edge[isMTLS > 0]');
    // @ts-ignore
    expect(instance.parseValue('traffic')).toEqual('edge[?protocol]');
    // @ts-ignore
    expect(instance.parseValue('!traffic')).toEqual('edge[^protocol]');

    // check all numeric operators
    // @ts-ignore
    expect(instance.parseValue('httpin < 5.0')).toEqual('node[httpIn < 5.0]');
    // @ts-ignore
    expect(instance.parseValue('httpin <= 5.0')).toEqual('node[httpIn <= 5.0]');
    // @ts-ignore
    expect(instance.parseValue('httpin > 5.0')).toEqual('node[httpIn > 5.0]');
    // @ts-ignore
    expect(instance.parseValue('httpin >= 5.0')).toEqual('node[httpIn >= 5.0]');
    // @ts-ignore
    expect(instance.parseValue('httpin = 5.0')).toEqual('node[httpIn = "5.0"]');
    // @ts-ignore
    expect(instance.parseValue('httpin != 5.0')).toEqual('node[httpIn != "5.0"]');

    // check all string operators
    // @ts-ignore
    expect(instance.parseValue('namespace = foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseValue('namespace *= foo')).toEqual('node[namespace *= "foo"]');
    // @ts-ignore
    expect(instance.parseValue('namespace ^= foo')).toEqual('node[namespace ^= "foo"]');
    // @ts-ignore
    expect(instance.parseValue('namespace $= foo')).toEqual('node[namespace $= "foo"]');
    // @ts-ignore
    expect(instance.parseValue('namespace != foo')).toEqual('node[namespace != "foo"]');
    // @ts-ignore
    expect(instance.parseValue('namespace !*= foo')).toEqual('node[namespace !*= "foo"]');
    // @ts-ignore
    expect(instance.parseValue('namespace !^= foo')).toEqual('node[namespace !^= "foo"]');
    // @ts-ignore
    expect(instance.parseValue('namespace !$= foo')).toEqual('node[namespace !$= "foo"]');
    // @ts-ignore
    expect(instance.parseValue('namespace contains foo')).toEqual('node[namespace *= "foo"]');
    // @ts-ignore
    expect(instance.parseValue('namespace startsWith foo')).toEqual('node[namespace ^= "foo"]');
    // @ts-ignore
    expect(instance.parseValue('namespace endsWith foo')).toEqual('node[namespace $= "foo"]');
    // @ts-ignore
    expect(instance.parseValue('namespace not contains foo')).toEqual('node[namespace !*= "foo"]');
    // @ts-ignore
    expect(instance.parseValue('namespace not startswith foo')).toEqual('node[namespace !^= "foo"]');
    // @ts-ignore
    expect(instance.parseValue('namespace not endswith foo')).toEqual('node[namespace !$= "foo"]');

    // check unary parsing
    // @ts-ignore
    expect(instance.parseValue('is mtls')).toEqual('edge[isMTLS > 0]');
    // @ts-ignore
    expect(instance.parseValue('has mtls')).toEqual('edge[isMTLS > 0]');
    // @ts-ignore
    expect(instance.parseValue('! mtls')).toEqual('edge[isMTLS <= 0]');
    // @ts-ignore
    expect(instance.parseValue('!has mtls')).toEqual('edge[isMTLS <= 0]');
    // @ts-ignore
    expect(instance.parseValue('!mtls')).toEqual('edge[isMTLS <= 0]');
    // @ts-ignore
    expect(instance.parseValue('not has mtls')).toEqual('edge[isMTLS <= 0]');

    // check binary parsing
    // @ts-ignore
    expect(instance.parseValue('ns =foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseValue('ns= foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseValue('ns  =  foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseValue('ns=foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseValue('ns not =foo')).toEqual('node[namespace != "foo"]');
    // @ts-ignore
    expect(instance.parseValue('ns!=foo')).toEqual('node[namespace != "foo"]');
    // @ts-ignore
    expect(instance.parseValue('ns not contains foo')).toEqual('node[namespace !*= "foo"]');
    // @ts-ignore
    expect(instance.parseValue('ns !contains foo')).toEqual('node[namespace !*= "foo"]');
    // @ts-ignore
    expect(instance.parseValue('ns ! contains foo')).toEqual('node[namespace !*= "foo"]');

    // check composites
    // @ts-ignore
    expect(instance.parseValue('ns=foo OR ns=bar')).toEqual('node[namespace = "foo"],[namespace = "bar"]');
    // @ts-ignore
    expect(instance.parseValue('ns=foo AND ns=bar')).toEqual('node[namespace = "foo"][namespace = "bar"]');

    // check find by name
    // @ts-ignore
    expect(instance.parseValue('name = foo')).toEqual('node[workload = "foo"],[app = "foo"],[service = "foo"]');
    // @ts-ignore
    expect(instance.parseValue('name != foo')).toEqual('node[workload != "foo"][app != "foo"][service != "foo"]');

    // check violations
    // @ts-ignore
    expect(instance.parseValue('foo')).toEqual(undefined); // invalid unary
    // @ts-ignore
    expect(instance.parseValue('!foo')).toEqual(undefined); // invalid negated unary
    // @ts-ignore
    expect(instance.parseValue('node = appp')).toEqual(undefined); // invalid node type
    // @ts-ignore
    expect(instance.parseValue('ns=foo OR ns=bar AND app=foo')).toEqual(undefined); // AND and OR
    // @ts-ignore
    expect(instance.parseValue('ns=foo AND http > 5.0')).toEqual(undefined); // Node and Edge
  });
});
