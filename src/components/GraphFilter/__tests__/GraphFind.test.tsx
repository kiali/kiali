import * as React from 'react';
import { shallow } from 'enzyme';

import { GraphFind } from '../GraphFind';

const testHandler = () => {
  console.log('handled');
};

const testSetter = val => {
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
    expect(instance.parseFindValue('httpin > 5.0')).toEqual('node[httpIn > 5.0]');
    // @ts-ignore
    expect(instance.parseFindValue('httpout < 5.0')).toEqual('node[httpOut < 5.0]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace = foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('ns = foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('node = app')).toEqual('node[nodeType = "app"]');
    // @ts-ignore
    expect(instance.parseFindValue('node = service')).toEqual('node[nodeType = "service"]');
    // @ts-ignore
    expect(instance.parseFindValue('node = svc')).toEqual('node[nodeType = "service"]');
    // @ts-ignore
    expect(instance.parseFindValue('node = unknown')).toEqual('node[nodeType = "unknown"]');
    // @ts-ignore
    expect(instance.parseFindValue('node = workload')).toEqual('node[nodeType = "workload"]');
    // @ts-ignore
    expect(instance.parseFindValue('node = wl')).toEqual('node[nodeType = "workload"]');
    // @ts-ignore
    expect(instance.parseFindValue('service = foo')).toEqual('node[service = "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('svc = foo')).toEqual('node[service = "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('version = foo')).toEqual('node[version = "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('tcpin > 5.0')).toEqual('node[tcpIn > 5.0]');
    // @ts-ignore
    expect(instance.parseFindValue('tcpout < 5.0')).toEqual('node[tcpOut < 5.0]');
    // @ts-ignore
    expect(instance.parseFindValue('workload = foo')).toEqual('node[workload = "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('wl = foo')).toEqual('node[workload = "foo"]');

    // @ts-ignore
    expect(instance.parseFindValue('circuitBreaker')).toEqual('node[hasCB]');
    // @ts-ignore
    expect(instance.parseFindValue('cb')).toEqual('node[hasCB]');
    // @ts-ignore
    expect(instance.parseFindValue('sidecar')).toEqual('node[^hasMissingSC]');
    // @ts-ignore
    expect(instance.parseFindValue('sc')).toEqual('node[^hasMissingSC]');
    // @ts-ignore
    expect(instance.parseFindValue('outside')).toEqual('node[isOutside]');
    // @ts-ignore
    expect(instance.parseFindValue('outsider')).toEqual('node[isOutside]');
    // @ts-ignore
    expect(instance.parseFindValue('root')).toEqual('node[isRoot]');
    // @ts-ignore
    expect(instance.parseFindValue('trafficsource')).toEqual('node[isRoot]');
    // @ts-ignore
    expect(instance.parseFindValue('virtualService')).toEqual('node[hasVS]');
    // @ts-ignore
    expect(instance.parseFindValue('vs')).toEqual('node[hasVS]');

    // check coverage of edge operands
    // @ts-ignore
    expect(instance.parseFindValue('grpc > 5.0')).toEqual('edge[grpc > 5.0]');
    // @ts-ignore
    expect(instance.parseFindValue('%grpcerror > 50')).toEqual('edge[grpcPercentErr > 50]');
    // @ts-ignore
    expect(instance.parseFindValue('%grpcerr > 50')).toEqual('edge[grpcPercentErr > 50]');
    // @ts-ignore
    expect(instance.parseFindValue('%grpctraffic > 50')).toEqual('edge[grpcPercentReq > 50]');
    // @ts-ignore
    expect(instance.parseFindValue('http > 5.0')).toEqual('edge[http > 5.0]');
    // @ts-ignore
    expect(instance.parseFindValue('%httperror > 50')).toEqual('edge[httpPercentErr > 50]');
    // @ts-ignore
    expect(instance.parseFindValue('%httperr > 50')).toEqual('edge[httpPercentErr > 50]');
    // @ts-ignore
    expect(instance.parseFindValue('%httptraffic > 50')).toEqual('edge[httpPercentReq > 50]');
    // @ts-ignore
    expect(instance.parseFindValue('responseTime > 5.0')).toEqual('edge[responseTime > 5.0]');
    // @ts-ignore
    expect(instance.parseFindValue('rt > 5.0')).toEqual('edge[responseTime > 5.0]');
    // @ts-ignore
    expect(instance.parseFindValue('tcp > 5.0')).toEqual('edge[tcp > 5.0]');

    // @ts-ignore
    expect(instance.parseFindValue('mtls')).toEqual('edge[isMTLS]');

    // check all numeric operators
    // @ts-ignore
    expect(instance.parseFindValue('httpin < 5.0')).toEqual('node[httpIn < 5.0]');
    // @ts-ignore
    expect(instance.parseFindValue('httpin <= 5.0')).toEqual('node[httpIn <= 5.0]');
    // @ts-ignore
    expect(instance.parseFindValue('httpin > 5.0')).toEqual('node[httpIn > 5.0]');
    // @ts-ignore
    expect(instance.parseFindValue('httpin >= 5.0')).toEqual('node[httpIn >= 5.0]');
    // @ts-ignore
    expect(instance.parseFindValue('httpin = 5.0')).toEqual('node[httpIn = "5.0"]');
    // @ts-ignore
    expect(instance.parseFindValue('httpin != 5.0')).toEqual('node[httpIn != "5.0"]');

    // check all string operators
    // @ts-ignore
    expect(instance.parseFindValue('namespace = foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace *= foo')).toEqual('node[namespace *= "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace ^= foo')).toEqual('node[namespace ^= "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace $= foo')).toEqual('node[namespace $= "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace != foo')).toEqual('node[namespace != "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace !*= foo')).toEqual('node[namespace !*= "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace !^= foo')).toEqual('node[namespace !^= "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace !$= foo')).toEqual('node[namespace !$= "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace contains foo')).toEqual('node[namespace *= "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace startsWith foo')).toEqual('node[namespace ^= "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace endsWith foo')).toEqual('node[namespace $= "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace not contains foo')).toEqual('node[namespace !*= "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace not startswith foo')).toEqual('node[namespace !^= "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('namespace not endswith foo')).toEqual('node[namespace !$= "foo"]');

    // check unary parsing
    // @ts-ignore
    expect(instance.parseFindValue('is mtls')).toEqual('edge[isMTLS]');
    // @ts-ignore
    expect(instance.parseFindValue('has mtls')).toEqual('edge[isMTLS]');
    // @ts-ignore
    expect(instance.parseFindValue('! mtls')).toEqual('edge[^isMTLS]');
    // @ts-ignore
    expect(instance.parseFindValue('!has mtls')).toEqual('edge[^isMTLS]');
    // @ts-ignore
    expect(instance.parseFindValue('!mtls')).toEqual('edge[^isMTLS]');
    // @ts-ignore
    expect(instance.parseFindValue('not has mtls')).toEqual('edge[^isMTLS]');

    // check binary parsing
    // @ts-ignore
    expect(instance.parseFindValue('ns =foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('ns= foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('ns  =  foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('ns=foo')).toEqual('node[namespace = "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('ns not =foo')).toEqual('node[namespace != "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('ns!=foo')).toEqual('node[namespace != "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('ns not contains foo')).toEqual('node[namespace !*= "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('ns !contains foo')).toEqual('node[namespace !*= "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('ns ! contains foo')).toEqual('node[namespace !*= "foo"]');

    // check composites
    // @ts-ignore
    expect(instance.parseFindValue('ns=foo OR ns=bar')).toEqual('node[namespace = "foo"],[namespace = "bar"]');
    // @ts-ignore
    expect(instance.parseFindValue('ns=foo AND ns=bar')).toEqual('node[namespace = "foo"][namespace = "bar"]');

    // check find by name
    // @ts-ignore
    expect(instance.parseFindValue('name = foo')).toEqual('node[workload = "foo"],[app = "foo"],[service = "foo"]');
    // @ts-ignore
    expect(instance.parseFindValue('name != foo')).toEqual('node[workload != "foo"][app != "foo"][service != "foo"]');

    // check violations
    // @ts-ignore
    expect(instance.parseFindValue('foo')).toEqual(undefined); // invalid unary
    // @ts-ignore
    expect(instance.parseFindValue('!foo')).toEqual(undefined); // invalid negated unary
    // @ts-ignore
    expect(instance.parseFindValue('node = appp')).toEqual(undefined); // invalid node type
    // @ts-ignore
    expect(instance.parseFindValue('ns=foo OR ns=bar AND app=foo')).toEqual(undefined); // AND and OR
    // @ts-ignore
    expect(instance.parseFindValue('ns=foo AND http > 5.0')).toEqual(undefined); // Node and Edge
  });
});
