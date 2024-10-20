import * as React from 'react';
import { shallow } from 'enzyme';
import { MeshFindComponent } from '../MeshFind';

const testHandler = () => undefined;
const testSetter = _val => undefined;

// TODO Find out why typescript is unhappy and get rid of all of these ts-ignores
describe('Parse find value test', () => {
  it('should return the correct selector for raw find values', () => {
    const wrapper = shallow(
      <MeshFindComponent
        controller={undefined}
        elementsChanged={true}
        findValue="testFind"
        hideValue="testHide"
        showFindHelp={false}
        setFindValue={testSetter}
        setHideValue={testSetter}
        toggleFindHelp={testHandler}
        layout={{ name: '' }}
      />
    );

    const instance = wrapper.instance() as MeshFindComponent;

    // check coverage of node operands
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

    // check coverage of edge operands

    // check all numeric operators

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
    expect(instance.parseValue('is healthy')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ prop: 'healthStatus', val: 'Healthy' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('has healthy')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ prop: 'healthStatus', val: 'Healthy' }]]
    });
    // @ts-ignore
    expect(instance.parseValue('! healthy')).toEqual({
      edgeSelector: [],
      nodeSelector: [
        [
          { op: '!=', prop: 'healthStatus', val: 'Healthy' },
          { op: '!=', prop: 'healthStatus', val: 'No health information' },
          { op: '!=', prop: 'healthStatus', val: 'Not Ready' }
        ]
      ]
    });
    // @ts-ignore
    expect(instance.parseValue('!has healthy')).toEqual({
      edgeSelector: [],
      nodeSelector: [
        [
          { op: '!=', prop: 'healthStatus', val: 'Healthy' },
          { op: '!=', prop: 'healthStatus', val: 'No health information' },
          { op: '!=', prop: 'healthStatus', val: 'Not Ready' }
        ]
      ]
    });
    // @ts-ignore
    expect(instance.parseValue('!healthy')).toEqual({
      edgeSelector: [],
      nodeSelector: [
        [
          { op: '!=', prop: 'healthStatus', val: 'Healthy' },
          { op: '!=', prop: 'healthStatus', val: 'No health information' },
          { op: '!=', prop: 'healthStatus', val: 'Not Ready' }
        ]
      ]
    });
    // @ts-ignore
    expect(instance.parseValue('not has healthy')).toEqual({
      edgeSelector: [],
      nodeSelector: [
        [
          { op: '!=', prop: 'healthStatus', val: 'Healthy' },
          { op: '!=', prop: 'healthStatus', val: 'No health information' },
          { op: '!=', prop: 'healthStatus', val: 'Not Ready' }
        ]
      ]
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
    // @ts-ignore
    expect(instance.parseValue('ns=foo OR ns=bar')).toEqual({
      edgeSelector: [],
      nodeSelector: [[{ op: '=', prop: 'namespace', val: 'foo' }], [{ op: '=', prop: 'namespace', val: 'bar' }]]
    }); // OR same target
    // @ts-ignore
    expect(instance.parseValue('ns=foo AND ns=bar')).toEqual({
      edgeSelector: [],
      nodeSelector: [
        [
          { op: '=', prop: 'namespace', val: 'foo' },
          { op: '=', prop: 'namespace', val: 'bar' }
        ]
      ]
    }); // AND same target
    // @ts-ignore
    expect(instance.parseValue('ns=foo OR ns=bar AND name=foo')).toEqual({
      edgeSelector: [],
      nodeSelector: [
        [{ op: '=', prop: 'namespace', val: 'foo' }],
        [
          { op: '=', prop: 'namespace', val: 'bar' },
          { op: '=', prop: 'infraName', val: 'foo' }
        ]
      ]
    }); // AND and OR same target
    /* TODO: Update if/when we have edge targets
    // @ts-ignore
    expect(instance.parseValue('ns=foo OR =http')).toEqual('node[namespace = "foo"],edge[protocol = "http"]'); // OR different targets
    // @ts-ignore
    expect(instance.parseValue('ns=foo OR protocol=http OR !traffic')).toEqual(
      'node[namespace = "foo"],edge[protocol = "http"],edge[^hasTraffic]'
    ); // OR different targets
    // @ts-ignore
    expect(instance.parseValue('ns=foo AND ns=bar OR protocol=http AND !traffic')).toEqual(
      'node[namespace = "foo"][namespace = "bar"],edge[protocol = "http"][^hasTraffic]'
    ); // OR different targets, each with AND
    */

    // check violations
    // @ts-ignore
    expect(instance.parseValue('foo')).toEqual({ edgeSelector: undefined, nodeSelector: undefined }); // invalid unary
    // @ts-ignore
    expect(instance.parseValue('!foo')).toEqual({ edgeSelector: undefined, nodeSelector: undefined }); // invalid negated unary
    // @ts-ignore
    expect(instance.parseValue('node = foo')).toEqual({ edgeSelector: undefined, nodeSelector: undefined }); // invalid node type
  });
});
