// Copyright (c) 2019 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as React from 'react';
import { shallow } from 'enzyme';
import _set from 'lodash/set';

import { DeepDependencyGraphPageImpl, mapDispatchToProps, mapStateToProps } from '.';
import * as url from './url';
import Graph from './Graph';
import Header from './Header';
import ErrorMessage from '../common/ErrorMessage';
import LoadingIndicator from '../common/LoadingIndicator';
import { fetchedState } from '../../constants';
import getStateEntryKey from '../../model/ddg/getStateEntryKey';
import * as GraphModel from '../../model/ddg/GraphModel';
import * as codec from '../../model/ddg/visibility-codec';

import { EDdgDensity, EViewModifier } from '../../model/ddg/types';

describe('DeepDependencyGraphPage', () => {
  describe('DeepDependencyGraphPageImpl', () => {
    const props = {
      addViewModifier: jest.fn(),
      fetchDeepDependencyGraph: () => {},
      fetchServices: jest.fn(),
      fetchServiceOperations: jest.fn(),
      graph: {
        getVisible: () => ({
          edges: [],
          vertices: [],
        }),
        getHiddenUiFindMatches: () => new Set(),
        getVertexVisiblePathElems: jest.fn(),
        getVisibleUiFindMatches: () => new Set(),
        getVisWithVertices: jest.fn(),
      },
      graphState: {
        model: {
          distanceToPathElems: new Map(),
        },
        state: fetchedState.DONE,
        viewModifiers: new Map(),
      },
      history: {
        push: jest.fn(),
      },
      operationsForService: {},
      removeViewModifierFromIndices: jest.fn(),
      urlState: {
        start: 'testStart',
        end: 'testEnd',
        service: 'testService',
        operation: 'testOperation',
        visEncoding: 'testVisKey',
      },
    };
    const ddgPageImpl = new DeepDependencyGraphPageImpl(props);

    describe('constructor', () => {
      beforeEach(() => {
        props.fetchServices.mockReset();
        props.fetchServiceOperations.mockReset();
      });

      it('fetches services if services are not provided', () => {
        new DeepDependencyGraphPageImpl({ ...props, services: [] }); // eslint-disable-line no-new
        expect(props.fetchServices).not.toHaveBeenCalled();
        new DeepDependencyGraphPageImpl(props); // eslint-disable-line no-new
        expect(props.fetchServices).toHaveBeenCalledTimes(1);
      });

      it('fetches operations if service is provided without operations', () => {
        const { service, ...urlState } = props.urlState;
        new DeepDependencyGraphPageImpl({ ...props, urlState }); // eslint-disable-line no-new
        expect(props.fetchServiceOperations).not.toHaveBeenCalled();
        new DeepDependencyGraphPageImpl({ ...props, operationsForService: { [service]: [] } }); // eslint-disable-line no-new
        expect(props.fetchServiceOperations).not.toHaveBeenCalled();
        new DeepDependencyGraphPageImpl(props); // eslint-disable-line no-new
        expect(props.fetchServiceOperations).toHaveBeenLastCalledWith(service);
        expect(props.fetchServiceOperations).toHaveBeenCalledTimes(1);
      });
    });

    describe('updateUrlState', () => {
      let getUrlSpy;

      beforeAll(() => {
        getUrlSpy = jest.spyOn(url, 'getUrl');
      });

      beforeEach(() => {
        getUrlSpy.mockReset();
        props.history.push.mockReset();
      });

      it('updates provided value', () => {
        ['service', 'operation', 'start', 'end', 'visEnconding'].forEach((propName, i) => {
          const value = `new ${propName}`;
          const kwarg = { [propName]: value };
          ddgPageImpl.updateUrlState(kwarg);
          expect(getUrlSpy).toHaveBeenLastCalledWith(Object.assign({}, props.urlState, kwarg), undefined);
          expect(props.history.push).toHaveBeenCalledTimes(i + 1);
        });
      });

      it('updates multiple values', () => {
        const kwarg = {
          end: 'new end',
          start: 'new start',
        };
        ddgPageImpl.updateUrlState(kwarg);
        expect(getUrlSpy).toHaveBeenLastCalledWith(Object.assign({}, props.urlState, kwarg), undefined);
        expect(props.history.push).toHaveBeenCalledTimes(1);
      });

      it('leaves unspecified, previously-undefined values as undefined', () => {
        const { start: _s, end: _e, ...otherUrlState } = props.urlState;
        const otherProps = {
          ...props,
          urlState: otherUrlState,
        };
        const kwarg = {
          end: 'new end',
        };
        const ddgPageWithFewerProps = new DeepDependencyGraphPageImpl(otherProps);
        ddgPageWithFewerProps.updateUrlState(kwarg);
        expect(getUrlSpy).toHaveBeenLastCalledWith(Object.assign({}, otherUrlState, kwarg), undefined);
        expect(getUrlSpy).not.toHaveBeenLastCalledWith(expect.objectContaining({ start: expect.anything() }));
        expect(props.history.push).toHaveBeenCalledTimes(1);
      });

      it('includes props.graphState.model.hash iff it is truthy', () => {
        ddgPageImpl.updateUrlState({});
        expect(getUrlSpy).toHaveBeenLastCalledWith(
          expect.not.objectContaining({ hash: expect.anything() }),
          undefined
        );

        const hash = 'testHash';
        const propsWithHash = {
          ...props,
          graphState: {
            ...props.graphState,
            model: {
              ...props.graphState.model,
              hash,
            },
          },
        };
        const ddgPageWithHash = new DeepDependencyGraphPageImpl(propsWithHash);
        ddgPageWithHash.updateUrlState({});
        expect(getUrlSpy).toHaveBeenLastCalledWith(expect.objectContaining({ hash }), undefined);
      });

      describe('setDistance', () => {
        const mockNewEncoding = '1';
        let encodeDistanceSpy;

        beforeAll(() => {
          encodeDistanceSpy = jest.spyOn(codec, 'encodeDistance').mockImplementation(() => mockNewEncoding);
        });

        it('updates url with result of encodeDistance iff graph is loaded', () => {
          const distance = -3;
          const direction = -1;
          const visEncoding = props.urlState.visEncoding;

          const { graphState: e, ...graphStatelessProps } = props;
          const graphStateless = new DeepDependencyGraphPageImpl(graphStatelessProps);
          graphStateless.setDistance(distance, direction);
          expect(encodeDistanceSpy).not.toHaveBeenCalled();
          expect(getUrlSpy).not.toHaveBeenCalled();
          expect(props.history.push).not.toHaveBeenCalled();

          const graphStateLoading = new DeepDependencyGraphPageImpl({
            ...graphStatelessProps,
            graphState: { state: fetchedState.LOADING },
          });
          graphStateLoading.setDistance(distance, direction);
          expect(encodeDistanceSpy).not.toHaveBeenCalled();
          expect(getUrlSpy).not.toHaveBeenCalled();
          expect(props.history.push).not.toHaveBeenCalled();

          ddgPageImpl.setDistance(distance, direction);
          expect(encodeDistanceSpy).toHaveBeenLastCalledWith({
            ddgModel: props.graphState.model,
            direction,
            distance,
            prevVisEncoding: visEncoding,
          });
          expect(getUrlSpy).toHaveBeenLastCalledWith(
            Object.assign({}, props.urlState, { visEncoding: mockNewEncoding }),
            undefined
          );
          expect(props.history.push).toHaveBeenCalledTimes(1);
        });
      });

      describe('setOperation', () => {
        it('updates operation and clears visEncoding', () => {
          const operation = 'newOperation';
          ddgPageImpl.setOperation(operation);
          expect(getUrlSpy).toHaveBeenLastCalledWith(
            Object.assign({}, props.urlState, { operation, visEncoding: undefined }),
            undefined
          );
          expect(props.history.push).toHaveBeenCalledTimes(1);
        });
      });

      describe('setService', () => {
        const service = 'newService';

        beforeEach(() => {
          props.fetchServiceOperations.mockReset();
        });

        it('updates service and clears operation and visEncoding', () => {
          ddgPageImpl.setService(service);
          expect(getUrlSpy).toHaveBeenLastCalledWith(
            Object.assign({}, props.urlState, { operation: undefined, service, visEncoding: undefined }),
            undefined
          );
          expect(props.history.push).toHaveBeenCalledTimes(1);
        });

        it('fetches operations for service when not yet provided', () => {
          ddgPageImpl.setService(service);
          expect(props.fetchServiceOperations).toHaveBeenLastCalledWith(service);
          expect(props.fetchServiceOperations).toHaveBeenCalledTimes(1);

          const pageWithOpForService = new DeepDependencyGraphPageImpl({
            ...props,
            operationsForService: { [service]: [props.urlState.operation] },
          });
          const { length: callCount } = props.fetchServiceOperations.mock.calls;
          pageWithOpForService.setService(service);
          expect(props.fetchServiceOperations).toHaveBeenCalledTimes(callCount);
        });
      });

      describe('showVertices', () => {
        const vertices = ['vertex0', 'vertex1'];
        const mockVisWithVertices = 'mockVisWithVertices';

        beforeAll(() => {
          props.graph.getVisWithVertices.mockReturnValue(mockVisWithVertices);
        });

        it('updates url with visEncoding calculated by graph', () => {
          ddgPageImpl.showVertices(vertices);
          expect(props.graph.getVisWithVertices).toHaveBeenLastCalledWith(
            vertices,
            props.urlState.visEncoding
          );
          expect(getUrlSpy).toHaveBeenLastCalledWith(
            Object.assign({}, props.urlState, { visEncoding: mockVisWithVertices }),
            undefined
          );
        });

        it('no-ops if not given graph', () => {
          const { graph: _, ...propsWithoutGraph } = props;
          const ddg = new DeepDependencyGraphPageImpl(propsWithoutGraph);
          const { length: callCount } = getUrlSpy.mock.calls;
          ddg.showVertices(vertices);
          expect(getUrlSpy.mock.calls.length).toBe(callCount);
        });
      });

      describe('setDensity', () => {
        it('updates url with provided density', () => {
          const density = EDdgDensity.PreventPathEntanglement;
          ddgPageImpl.setDensity(density);
          expect(getUrlSpy).toHaveBeenLastCalledWith(
            Object.assign({}, props.urlState, { density }),
            undefined
          );
        });
      });

      describe('toggleShowOperations', () => {
        it('updates url with provided boolean', () => {
          let showOp = true;
          ddgPageImpl.toggleShowOperations(showOp);
          expect(getUrlSpy).toHaveBeenLastCalledWith(
            Object.assign({}, props.urlState, { showOp }),
            undefined
          );

          showOp = false;
          ddgPageImpl.toggleShowOperations(showOp);
          expect(getUrlSpy).toHaveBeenLastCalledWith(
            Object.assign({}, props.urlState, { showOp }),
            undefined
          );
        });
      });
    });

    describe('view modifiers', () => {
      const vertexKey = 'test vertex key';
      const visibilityIndices = ['visId0', 'visId1', 'visId2'];
      const targetVM = EViewModifier.Emphasized;

      beforeAll(() => {
        props.graph.getVertexVisiblePathElems.mockReturnValue(
          visibilityIndices.map(visibilityIdx => ({ visibilityIdx }))
        );
      });

      beforeEach(() => {
        props.addViewModifier.mockReset();
        props.graph.getVertexVisiblePathElems.mockClear();
        props.removeViewModifierFromIndices.mockReset();
      });

      it('adds given viewModifier to specified pathElems', () => {
        ddgPageImpl.setViewModifier(vertexKey, targetVM, true);
        expect(props.addViewModifier).toHaveBeenLastCalledWith({
          operation: props.urlState.operation,
          service: props.urlState.service,
          viewModifier: targetVM,
          visibilityIndices,
          end: 0,
          start: 0,
        });
        expect(props.graph.getVertexVisiblePathElems).toHaveBeenCalledWith(
          vertexKey,
          props.urlState.visEncoding
        );
      });

      it('removes given viewModifier from specified pathElems', () => {
        ddgPageImpl.setViewModifier(vertexKey, targetVM, false);
        expect(props.removeViewModifierFromIndices).toHaveBeenCalledWith({
          operation: props.urlState.operation,
          service: props.urlState.service,
          viewModifier: targetVM,
          visibilityIndices,
          end: 0,
          start: 0,
        });
        expect(props.graph.getVertexVisiblePathElems).toHaveBeenCalledWith(
          vertexKey,
          props.urlState.visEncoding
        );
      });

      it('throws error if given absent vertexKey', () => {
        props.graph.getVertexVisiblePathElems.mockReturnValueOnce(undefined);
        const absentVertexKey = 'absentVertexKey';
        expect(() =>
          ddgPageImpl.setViewModifier(absentVertexKey, EViewModifier.emphasized, true)
        ).toThrowError(new RegExp(`Invalid vertex key.*${absentVertexKey}`));
      });

      it('no-ops if not given dispatch fn or graph or operation or service', () => {
        const { addViewModifier: _add, ...propsWithoutAdd } = props;
        const ddgWithoutAdd = new DeepDependencyGraphPageImpl(propsWithoutAdd);
        ddgWithoutAdd.setViewModifier(vertexKey, EViewModifier.emphasized, true);
        expect(props.graph.getVertexVisiblePathElems).not.toHaveBeenCalled();

        const { removeViewModifierFromIndices: _remove, ...propsWithoutRemove } = props;
        const ddgWithoutRemove = new DeepDependencyGraphPageImpl(propsWithoutRemove);
        ddgWithoutRemove.setViewModifier(vertexKey, EViewModifier.emphasized, false);
        expect(props.graph.getVertexVisiblePathElems).not.toHaveBeenCalled();

        const { graph: _graph, ...propsWithoutGraph } = props;
        const ddgWithoutGraph = new DeepDependencyGraphPageImpl(propsWithoutGraph);
        ddgWithoutGraph.setViewModifier(vertexKey, EViewModifier.emphasized, true);
        expect(props.graph.getVertexVisiblePathElems).not.toHaveBeenCalled();

        const {
          urlState: { operation: _operation, ...urlStateWithoutOperation },
          ...propsWithoutOperation
        } = props;
        propsWithoutOperation.urlState = urlStateWithoutOperation;
        const ddgWithoutOperation = new DeepDependencyGraphPageImpl(propsWithoutGraph);
        ddgWithoutOperation.setViewModifier(vertexKey, EViewModifier.emphasized, true);
        expect(props.graph.getVertexVisiblePathElems).not.toHaveBeenCalled();

        const {
          urlState: { service: _service, ...urlStateWithoutService },
          ...propsWithoutService
        } = props;
        propsWithoutService.urlState = urlStateWithoutService;
        const ddgWithoutService = new DeepDependencyGraphPageImpl(propsWithoutGraph);
        ddgWithoutService.setViewModifier(vertexKey, EViewModifier.emphasized, true);
        expect(props.graph.getVertexVisiblePathElems).not.toHaveBeenCalled();
      });
    });

    describe('getVisiblePathElems', () => {
      const vertexKey = 'test vertex key';
      const mockVisibleElems = 'mock visible elems';

      beforeAll(() => {
        props.graph.getVertexVisiblePathElems.mockReturnValue(mockVisibleElems);
      });

      it('returns visible pathElems', () => {
        expect(ddgPageImpl.getVisiblePathElems(vertexKey)).toBe(mockVisibleElems);
        expect(props.graph.getVertexVisiblePathElems).toHaveBeenLastCalledWith(
          vertexKey,
          props.urlState.visEncoding
        );
      });

      it('no-ops if not given graph', () => {
        const { graph: _, ...propsWithoutGraph } = props;
        const ddg = new DeepDependencyGraphPageImpl(propsWithoutGraph);
        expect(() => ddg.getVisiblePathElems(vertexKey)).not.toThrowError();
      });
    });

    describe('render', () => {
      const vertices = [{ key: 'key0' }, { key: 'key1' }, { key: 'key2' }];
      const graph = {
        getVisible: () => ({
          edges: [
            {
              from: vertices[0].key,
              to: vertices[1].key,
            },
            {
              from: vertices[1].key,
              to: vertices[2].key,
            },
          ],
          vertices,
        }),
        getDerivedViewModifiers: () => ({ edges: new Map(), vertices: new Map() }),
        getHiddenUiFindMatches: () => new Set(vertices.slice(1)),
        getVisibleUiFindMatches: () => new Set(vertices.slice(0, 1)),
        getVisibleIndices: () => new Set(),
      };

      it('renders message to query a ddg when no graphState is provided', () => {
        const message = shallow(<DeepDependencyGraphPageImpl {...props} graphState={undefined} />)
          .find('h1')
          .last();
        expect(message.text()).toBe('Enter query above');
      });

      it('renders LoadingIndicator when loading', () => {
        const wrapper = shallow(
          <DeepDependencyGraphPageImpl {...props} graphState={{ state: fetchedState.LOADING }} />
        );
        expect(wrapper.find(LoadingIndicator)).toHaveLength(1);
      });

      it('renders ErrorMessage when erred', () => {
        const error = 'Some API error';
        const errorComponent = shallow(
          <DeepDependencyGraphPageImpl {...props} graphState={{ error, state: fetchedState.ERROR }} />
        ).find(ErrorMessage);
        expect(errorComponent).toHaveLength(1);
        expect(errorComponent.prop('error')).toBe(error);
      });

      it('renders graph when done', () => {
        const wrapper = shallow(<DeepDependencyGraphPageImpl {...props} graph={graph} />);
        expect(wrapper.find(Graph)).toHaveLength(1);
      });

      it('renders indication of unknown graphState', () => {
        const state = 'invalid state';
        const unknownIndication = shallow(<DeepDependencyGraphPageImpl {...props} graphState={{ state }} />)
          .find('div')
          .find('div')
          .last()
          .text();
        expect(unknownIndication).toMatch(new RegExp(state));
        expect(unknownIndication).toMatch(/Unknown graphState/);
      });

      it('renders indication of unknown state when done but no graph is provided', () => {
        const { graph: _, ...propsWithoutGraph } = props;
        const wrapper = shallow(<DeepDependencyGraphPageImpl {...propsWithoutGraph} />);
        const unknownIndication = wrapper
          .find('div')
          .find('div')
          .last()
          .text();
        expect(wrapper.find(Graph)).toHaveLength(0);
        expect(unknownIndication).toMatch(/Unknown graphState/);
      });

      it('calculates uiFindCount and hiddenUiFindMatches', () => {
        const wrapper = shallow(
          <DeepDependencyGraphPageImpl {...props} graph={undefined} uiFind="truthy uiFind" />
        );
        expect(wrapper.find(Header).prop('uiFindCount')).toBe(undefined);
        expect(wrapper.find(Header).prop('hiddenUiFindMatches')).toBe(undefined);

        wrapper.setProps({ graph });
        expect(wrapper.find(Header).prop('uiFindCount')).toBe(1);
        expect(wrapper.find(Header).prop('hiddenUiFindMatches').size).toBe(vertices.length - 1);
      });

      it('passes correct operations to Header', () => {
        const wrapper = shallow(
          <DeepDependencyGraphPageImpl {...props} graph={graph} operationsForService={undefined} />
        );
        expect(wrapper.find(Header).prop('operations')).toBe(undefined);

        const operationsForService = {
          [props.urlState.service]: ['testOperation0', 'testOperation1'],
        };
        wrapper.setProps({ operationsForService });
        expect(wrapper.find(Header).prop('operations')).toBe(operationsForService[props.urlState.service]);

        const { service: _, ...urlStateWithoutService } = props.urlState;
        wrapper.setProps({ urlState: urlStateWithoutService });
        expect(wrapper.find(Header).prop('operations')).toBe(undefined);
      });
    });
  });

  describe('mapDispatchToProps()', () => {
    it('creates the actions correctly', () => {
      expect(mapDispatchToProps(() => {})).toEqual({
        addViewModifier: expect.any(Function),
        fetchDeepDependencyGraph: expect.any(Function),
        fetchServices: expect.any(Function),
        fetchServiceOperations: expect.any(Function),
        removeViewModifierFromIndices: expect.any(Function),
      });
    });
  });

  describe('mapStateToProps()', () => {
    const start = 'testStart';
    const end = 'testEnd';
    const service = 'testService';
    const operation = 'testOperation';
    const search = '?someParam=someValue';
    const expected = {
      urlState: {
        start,
        end,
        service,
        operation,
      },
    };
    const services = [service];
    const operationsForService = {
      [service]: ['some operation'],
    };
    const state = {
      otherState: 'otherState',
      router: {
        location: {
          search: 'search',
        },
      },
      services: {
        operationsForService,
        otherState: 'otherState',
        services,
      },
    };
    const ownProps = { location: { search } };
    const mockGraph = { getVisible: () => ({}) };
    const hash = 'testHash';
    const doneState = _set(
      { ...state },
      ['ddg', getStateEntryKey({ service, operation, start: 0, end: 0 })],
      {
        model: { hash },
        state: fetchedState.DONE,
      }
    );
    let getUrlStateSpy;
    let makeGraphSpy;
    let sanitizeUrlStateSpy;

    beforeAll(() => {
      getUrlStateSpy = jest.spyOn(url, 'getUrlState');
      sanitizeUrlStateSpy = jest.spyOn(url, 'sanitizeUrlState');
      makeGraphSpy = jest.spyOn(GraphModel, 'makeGraph').mockReturnValue(mockGraph);
    });

    beforeEach(() => {
      getUrlStateSpy.mockClear();
      getUrlStateSpy.mockReturnValue(expected.urlState);
      makeGraphSpy.mockClear();
    });

    it('uses gets relevant params from location.search', () => {
      const result = mapStateToProps(state, ownProps);
      expect(result).toEqual(expect.objectContaining(expected));
      expect(getUrlStateSpy).toHaveBeenLastCalledWith(search);
    });

    it('includes graphState iff location.search has service, start, end, and optionally operation', () => {
      const graphState = 'testGraphState';
      const graphStateWithoutOp = 'testGraphStateWithoutOp';
      const reduxState = { ...state };
      // TODO: Remove 0s once time buckets are implemented
      _set(reduxState, ['ddg', getStateEntryKey({ service, operation, start: 0, end: 0 })], graphState);
      _set(reduxState, ['ddg', getStateEntryKey({ service, start, end })], graphStateWithoutOp);

      const result = mapStateToProps(reduxState, ownProps);
      expect(result.graphState).toEqual(graphState);

      /* TODO: operation is still required, when requirement is lifted, re-enable
      const { operation: _op, ...rest } = expected.urlState;
      getUrlStateSpy.mockReturnValue(rest);
      const resultWithoutOp = mapStateToProps(reduxState, ownProps);
      expect(resultWithoutOp.graphState).toEqual(graphStateWithoutOp);
      */

      getUrlStateSpy.mockReturnValue({});
      const resultWithoutParams = mapStateToProps(reduxState, ownProps);
      expect(resultWithoutParams.graphState).toBeUndefined();
    });

    it('includes graph iff graphState.state is fetchedState.DONE', () => {
      const loadingState = { state: fetchedState.LOADING };
      const reduxState = { ...state };
      // TODO: Remove 0s once time buckets are implemented
      _set(reduxState, ['ddg', getStateEntryKey({ service, operation, start: 0, end: 0 })], loadingState);
      const result = mapStateToProps(reduxState, ownProps);
      expect(result.graph).toBe(undefined);

      const doneResult = mapStateToProps(doneState, ownProps);
      expect(doneResult.graph).toBe(mockGraph);
    });

    it('includes services and operationsForService', () => {
      expect(mapStateToProps(state, ownProps)).toEqual(
        expect.objectContaining({ operationsForService, services })
      );
    });

    it('sanitizes urlState', () => {
      mapStateToProps(doneState, ownProps);
      expect(sanitizeUrlStateSpy).toHaveBeenLastCalledWith(expected.urlState, hash);
    });
  });
});
