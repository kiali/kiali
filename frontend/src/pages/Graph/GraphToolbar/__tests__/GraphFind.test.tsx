import * as React from 'react';
import { shallow } from 'enzyme';
import { GraphFindComponent } from '../GraphFind';
import { EdgeLabelMode, EdgeMode } from 'types/Graph';
import { Controller } from '@patternfly/react-topology';

const testHandler = () => undefined;
const testSetter = _val => undefined;

// TODO Find out why typescript is unhappy and get rid of all of these ts-ignores
describe('Parse find value test', () => {
  it('should return the correct selector for raw find values', () => {
    const wrapper = shallow(
      <GraphFindComponent
        controller={{} as Controller}
        edgeLabels={[] as EdgeLabelMode[]}
        edgeMode={EdgeMode.ALL}
        elementsChanged={true}
        findValue="testFind"
        hideValue="testHide"
        showFindHelp={false}
        showRank={true}
        showSecurity={false}
        showIdleNodes={false}
        showVirtualServices={true}
        setEdgeLabels={testSetter}
        setFindValue={testSetter}
        setHideValue={testSetter}
        toggleFindHelp={testHandler}
        toggleGraphSecurity={testHandler}
        toggleGraphVirtualServices={testHandler}
        toggleIdleNodes={testHandler}
        toggleRank={testHandler}
      />
    );

    const instance = wrapper.instance() as GraphFindComponent;

    // check coverage of node operands
    // @ts-ignore
    expect(instance.parseValue('httpin > 5.0')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '>', prop: 'httpIn', val: '5.0' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('httpout < 5.0')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '<', prop: 'httpOut', val: '5.0' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace = foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('ns = foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('app = foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'app', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('node = app')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'nodeType', val: 'app' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('node = operation')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'nodeType', val: 'aggregate' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('node = op')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'nodeType', val: 'aggregate' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('node = service')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'nodeType', val: 'service' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('node = svc')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'nodeType', val: 'service' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('node = unknown')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'nodeType', val: 'unknown' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('node = workload')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'nodeType', val: 'workload' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('node = wl')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'nodeType', val: 'workload' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('operation = foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'aggregateValue', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('op = foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'aggregateValue', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('rank = 1')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'rank', val: '1' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('service = foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'service', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('svc = foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'service', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('version = foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'version', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('tcpin > 5.0')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '>', prop: 'tcpIn', val: '5.0' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('tcpout < 5.0')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '<', prop: 'tcpOut', val: '5.0' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('workload = foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'workload', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('wl = foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'workload', val: 'foo' }]]
    });

    // @ts-ignore
    expect(instance.parseValue('circuitBreaker')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasCB' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('cb')).toEqual({ edgeSelector: [], nodeSelector: [[{ op: 'truthy', prop: 'hasCB' }]] });
    // @ts-ignore
    expect(instance.parseValue('faultinjection')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasFaultInjection' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('fi')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasFaultInjection' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('mirroring')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasMirroring' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('outside')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'isOutside' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('outsider')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'isOutside' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('requestrouting')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasRequestRouting' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('rr')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasRequestRouting' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('requesttimeout')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasRequestTimeout' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('rto')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasRequestTimeout' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('root')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'isRoot' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('sidecar')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'isOutOfMesh' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('sc')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'isOutOfMesh' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('tcptrafficshifting')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasTCPTrafficShifting' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('tcpts')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasTCPTrafficShifting' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('trafficshifting')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasTrafficShifting' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('ts')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasTrafficShifting' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('trafficsource')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'isRoot' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('virtualService')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasVS' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('vs')).toEqual({ edgeSelector: [], nodeSelector: [[{ op: 'truthy', prop: 'hasVS' }]] });
    // @ts-ignore
    expect(instance.parseValue('we')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasWorkloadEntry' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('workloadentry')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: 'truthy', prop: 'hasWorkloadEntry' }]]
    });

    // check coverage of edge operands
    // @ts-ignore
    expect(instance.parseValue('destprincipal contains spiffe')).toEqual({
      edgeSelector: [[{ op: '*=', prop: 'destPrincipal', val: 'spiffe' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('grpc > 5.0')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'grpc', val: '5.0' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('%grpcerror > 50')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'grpcPercentErr', val: '50' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('%grpcerr > 50')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'grpcPercentErr', val: '50' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('%grpctraffic > 50')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'grpcPercentReq', val: '50' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('http > 5.0')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'http', val: '5.0' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('%httperror > 50')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'httpPercentErr', val: '50' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('%httperr > 50')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'httpPercentErr', val: '50' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('%httptraffic > 50')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'httpPercentReq', val: '50' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('protocol = http')).toEqual({
      edgeSelector: [[{ op: '=', prop: 'protocol', val: 'http' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('responseTime > 5.0')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'responseTime', val: '5.0' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('rt > 5.0')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'responseTime', val: '5.0' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('sourceprincipal contains spiffe')).toEqual({
      edgeSelector: [[{ op: '*=', prop: 'sourcePrincipal', val: 'spiffe' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('tcp > 5.0')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'tcp', val: '5.0' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('throughput > 5.0')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'throughput', val: '5.0' }]],
      nodeSelector: []
    });

    // @ts-ignore
    expect(instance.parseValue('mtls')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'isMTLS', val: 0 }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('traffic')).toEqual({
      edgeSelector: [[{ op: 'truthy', prop: 'hasTraffic' }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('!traffic')).toEqual({
      edgeSelector: [[{ op: 'falsy', prop: 'hasTraffic' }]],
      nodeSelector: []
    });

    // check all numeric operators
    // @ts-ignore
    expect(instance.parseValue('httpin < 5.0')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '<', prop: 'httpIn', val: '5.0' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('httpin <= 5.0')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '<=', prop: 'httpIn', val: '5.0' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('httpin > 5.0')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '>', prop: 'httpIn', val: '5.0' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('httpin >= 5.0')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '>=', prop: 'httpIn', val: '5.0' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('httpin = 5.0')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'httpIn', val: '5.0' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('httpin != 5.0')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '!=', prop: 'httpIn', val: '5.0' }]]
    });

    // check all string operators
    // @ts-ignore
    expect(instance.parseValue('namespace = foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace *= foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '*=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace ^= foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '^=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace $= foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '$=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace != foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '!=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace !*= foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '!*=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace !^= foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '!^=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace !$= foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '!$=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace contains foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '*=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace startsWith foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '^=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace endsWith foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '$=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace not contains foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '!*=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace not startswith foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '!^=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('namespace not endswith foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '!$=', prop: 'namespace', val: 'foo' }]]
    });

    // check unary parsing
    // @ts-ignore
    expect(instance.parseValue('is mtls')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'isMTLS', val: 0 }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('has mtls')).toEqual({
      edgeSelector: [[{ op: '>', prop: 'isMTLS', val: 0 }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('! mtls')).toEqual({
      edgeSelector: [[{ op: '<=', prop: 'isMTLS', val: 0 }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('!has mtls')).toEqual({
      edgeSelector: [[{ op: '<=', prop: 'isMTLS', val: 0 }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('!mtls')).toEqual({
      edgeSelector: [[{ op: '<=', prop: 'isMTLS', val: 0 }]],
      nodeSelector: []
    });
    // @ts-ignore
    expect(instance.parseValue('not has mtls')).toEqual({
      edgeSelector: [[{ op: '<=', prop: 'isMTLS', val: 0 }]],
      nodeSelector: []
    });

    // check binary parsing
    // @ts-ignore
    expect(instance.parseValue('ns =foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('ns= foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('ns  =  foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('ns=foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('ns not =foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '!=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('ns!=foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '!=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('ns not contains foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '!*=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('ns !contains foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '!*=', prop: 'namespace', val: 'foo' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('ns ! contains foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '!*=', prop: 'namespace', val: 'foo' }]]
    });

    // check composites

    // OR same target
    // @ts-ignore
    expect(instance.parseValue('ns=foo OR ns=bar')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'namespace', val: 'foo' }], [{ op: '=', prop: 'namespace', val: 'bar' }]]
    });

    // AND same target
    // @ts-ignore
    expect(instance.parseValue('ns=foo AND ns=bar')).toEqual({
      edgeSelector: [],
      nodeSelector: [
        [
          { op: '=', prop: 'namespace', val: 'foo' },
          { op: '=', prop: 'namespace', val: 'bar' }
        ]
      ]
    });

    // AND and OR same target
    // @ts-ignore
    expect(instance.parseValue('ns=foo OR ns=bar AND app=foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [
        [{ op: '=', prop: 'namespace', val: 'foo' }],
        [
          { op: '=', prop: 'namespace', val: 'bar' },
          { op: '=', prop: 'app', val: 'foo' }
        ]
      ]
    });

    // OR different targets
    // @ts-ignore
    expect(instance.parseValue('ns=foo OR protocol=http')).toEqual({
      edgeSelector: [[{ op: '=', prop: 'protocol', val: 'http' }]],
      nodeSelector: [[{ op: '=', prop: 'namespace', val: 'foo' }]]
    });

    // OR different targets
    // @ts-ignore
    expect(instance.parseValue('ns=foo OR protocol=http OR !traffic')).toEqual({
      edgeSelector: [[{ op: '=', prop: 'protocol', val: 'http' }], [{ op: 'falsy', prop: 'hasTraffic' }]],
      nodeSelector: [[{ op: '=', prop: 'namespace', val: 'foo' }]]
    });

    // OR different targets, each with AND
    // @ts-ignore
    expect(instance.parseValue('ns=foo AND ns=bar OR protocol=http AND !traffic')).toEqual({
      edgeSelector: [
        [
          { op: '=', prop: 'protocol', val: 'http' },
          { op: 'falsy', prop: 'hasTraffic' }
        ]
      ],
      nodeSelector: [
        [
          { op: '=', prop: 'namespace', val: 'foo' },
          { op: '=', prop: 'namespace', val: 'bar' }
        ]
      ]
    });

    // check find by name
    // @ts-ignore
    expect(instance.parseValue('name = foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [
        [{ op: '=', prop: 'aggregateValue', val: 'foo' }],
        [{ op: '=', prop: 'app', val: 'foo' }],
        [{ op: '=', prop: 'service', val: 'foo' }],
        [{ op: '=', prop: 'workload', val: 'foo' }]
      ]
    });
    // @ts-ignore
    expect(instance.parseValue('name != foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [
        [
          { op: '!=', prop: 'aggregateValue', val: 'foo' },
          { op: '!=', prop: 'app', val: 'foo' },
          { op: '!=', prop: 'service', val: 'foo' },
          { op: '!=', prop: 'workload', val: 'foo' }
        ]
      ]
    });

    // check violations
    // @ts-ignore
    expect(instance.parseValue('foo')).toEqual({ edgeSelector: undefined, nodeSelector: undefined }); // invalid unary
    // @ts-ignore
    expect(instance.parseValue('!foo')).toEqual({ edgeSelector: undefined, nodeSelector: undefined }); // invalid negated unary
    // @ts-ignore
    expect(instance.parseValue('node = appp')).toEqual({ edgeSelector: undefined, nodeSelector: undefined }); // invalid node type
    // @ts-ignore
    expect(instance.parseValue('ns=foo AND http > 5.0')).toEqual({ edgeSelector: undefined, nodeSelector: undefined }); // Node and Edge
    // @ts-ignore
    expect(instance.parseValue('rank = a')).toEqual({ edgeSelector: undefined, nodeSelector: undefined }); // not a number
    // @ts-ignore
    expect(instance.parseValue('rank = 101')).toEqual({ edgeSelector: undefined, nodeSelector: undefined }); // outside acceptable range
  });
});
