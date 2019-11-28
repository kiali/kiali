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
import { History as RouterHistory, Location } from 'history';
import _get from 'lodash/get';
import { bindActionCreators, Dispatch } from 'redux';
import { connect } from 'react-redux';

import Header from './Header';
import Graph from './Graph';
import { getUrl, getUrlState, sanitizeUrlState, ROUTE_PATH } from './url';
import ErrorMessage from '../common/ErrorMessage';
import LoadingIndicator from '../common/LoadingIndicator';
import { extractUiFindFromState, TExtractUiFindFromStateReturn } from '../common/UiFindInput';
import ddgActions from '../../actions/ddg';
import * as jaegerApiActions from '../../actions/jaeger-api';
import { fetchedState } from '../../constants';
import getStateEntryKey from '../../model/ddg/getStateEntryKey';
import GraphModel, { makeGraph } from '../../model/ddg/GraphModel';
import {
  EDirection,
  TDdgModelParams,
  TDdgSparseUrlState,
  TDdgVertex,
  EDdgDensity,
  EViewModifier,
} from '../../model/ddg/types';
import { encodeDistance } from '../../model/ddg/visibility-codec';
import { ReduxState } from '../../types';
import { TDdgStateEntry } from '../../types/TDdgState';

import './index.css';

export type TDispatchProps = {
  addViewModifier?: (kwarg: TDdgModelParams & { viewModifier: number; visibilityIndices: number[] }) => void;
  fetchDeepDependencyGraph?: (query: TDdgModelParams) => void;
  fetchServices?: () => void;
  fetchServiceOperations?: (service: string) => void;
  removeViewModifierFromIndices?: (
    kwarg: TDdgModelParams & { viewModifier: number; visibilityIndices: number[] }
  ) => void;
};

export type TReduxProps = TExtractUiFindFromStateReturn & {
  graph: GraphModel | undefined;
  graphState?: TDdgStateEntry;
  operationsForService?: Record<string, string[]>;
  services?: string[] | null;
  urlState: TDdgSparseUrlState;
};

export type TOwnProps = {
  baseUrl: string;
  extraUrlArgs?: { [key: string]: unknown };
  history: RouterHistory;
  location: Location;
  showSvcOpsHeader: boolean;
};

export type TProps = TDispatchProps & TReduxProps & TOwnProps;

// export for tests
export class DeepDependencyGraphPageImpl extends React.PureComponent<TProps> {
  static defaultProps = {
    showSvcOpsHeader: true,
    baseUrl: ROUTE_PATH,
  };

  static fetchModelIfStale(props: TProps) {
    const { fetchDeepDependencyGraph, graphState = null, urlState } = props;
    const { service, operation } = urlState;
    // backend temporarily requires service and operation
    if (!graphState && service && operation && fetchDeepDependencyGraph) {
      fetchDeepDependencyGraph({ service, operation, start: 0, end: 0 });
    }
  }

  constructor(props: TProps) {
    super(props);
    DeepDependencyGraphPageImpl.fetchModelIfStale(props);

    const { fetchServices, fetchServiceOperations, operationsForService, services, urlState } = props;
    const { service } = urlState;

    if (!services && fetchServices) {
      fetchServices();
    }
    if (
      service &&
      operationsForService &&
      !Reflect.has(operationsForService, service) &&
      fetchServiceOperations
    ) {
      fetchServiceOperations(service);
    }
  }

  componentWillReceiveProps(nextProps: TProps) {
    DeepDependencyGraphPageImpl.fetchModelIfStale(nextProps);
  }

  getVisiblePathElems = (key: string) => {
    const { graph, urlState } = this.props;
    if (graph) {
      return graph.getVertexVisiblePathElems(key, urlState.visEncoding);
    }
    return undefined;
  };

  setDistance = (distance: number, direction: EDirection) => {
    const { graphState } = this.props;
    const { visEncoding } = this.props.urlState;

    if (graphState && graphState.state === fetchedState.DONE) {
      const { model: ddgModel } = graphState;

      this.updateUrlState({
        visEncoding: encodeDistance({
          ddgModel,
          direction,
          distance,
          prevVisEncoding: visEncoding,
        }),
      });
    }
  };

  setDensity = (density: EDdgDensity) => this.updateUrlState({ density });

  setOperation = (operation: string) => {
    this.updateUrlState({ operation, visEncoding: undefined });
  };

  setService = (service: string) => {
    const { fetchServiceOperations, operationsForService } = this.props;
    if (operationsForService && !Reflect.has(operationsForService, service) && fetchServiceOperations) {
      fetchServiceOperations(service);
    }
    this.updateUrlState({ operation: undefined, service, visEncoding: undefined });
  };

  setViewModifier = (vertexKey: string, viewModifier: EViewModifier, enable: boolean) => {
    const { addViewModifier, graph, removeViewModifierFromIndices, urlState } = this.props;
    const fn = enable ? addViewModifier : removeViewModifierFromIndices;
    const { service, operation, visEncoding } = urlState;
    if (!fn || !graph || !operation || !service) {
      return;
    }
    const pathElems = graph.getVertexVisiblePathElems(vertexKey, visEncoding);
    if (!pathElems) {
      throw new Error(`Invalid vertex key to set view modifier for: ${vertexKey}`);
    }
    const visibilityIndices = pathElems.map(pe => pe.visibilityIdx);
    fn({
      operation,
      service,
      viewModifier,
      visibilityIndices,
      end: 0,
      start: 0,
    });
  };

  showVertices = (vertices: TDdgVertex[]) => {
    const { graph, urlState } = this.props;
    const { visEncoding } = urlState;
    if (!graph) return;
    this.updateUrlState({ visEncoding: graph.getVisWithVertices(vertices, visEncoding) });
  };

  toggleShowOperations = (enable: boolean) => this.updateUrlState({ showOp: enable });

  updateUrlState = (newValues: Partial<TDdgSparseUrlState>) => {
    const { baseUrl, extraUrlArgs, graphState, history, uiFind, urlState } = this.props;
    const getUrlArg = { uiFind, ...urlState, ...newValues, ...extraUrlArgs };
    const hash = _get(graphState, 'model.hash');
    if (hash) getUrlArg.hash = hash;
    history.push(getUrl(getUrlArg, baseUrl));
  };

  render() {
    const {
      baseUrl,
      extraUrlArgs,
      graph,
      graphState,
      operationsForService,
      services,
      uiFind,
      urlState,
      showSvcOpsHeader,
    } = this.props;
    const { density, operation, service, showOp, visEncoding } = urlState;
    const distanceToPathElems =
      graphState && graphState.state === fetchedState.DONE ? graphState.model.distanceToPathElems : undefined;
    const uiFindMatches = graph && graph.getVisibleUiFindMatches(uiFind, visEncoding);
    const hiddenUiFindMatches = graph && graph.getHiddenUiFindMatches(uiFind, visEncoding);

    let content: React.ReactElement | null = null;
    if (!graphState) {
      content = <h1>Enter query above</h1>;
    } else if (graphState.state === fetchedState.DONE && graph) {
      const { edges, vertices } = graph.getVisible(visEncoding);
      const { viewModifiers } = graphState;
      const { edges: edgesViewModifiers, vertices: verticesViewModifiers } = graph.getDerivedViewModifiers(
        visEncoding,
        viewModifiers
      );
      // TODO: using `key` here is a hack, debug digraph to fix the underlying issue
      content = (
        <Graph
          key={JSON.stringify(urlState)}
          baseUrl={baseUrl}
          density={density}
          edges={edges}
          edgesViewModifiers={edgesViewModifiers}
          extraUrlArgs={extraUrlArgs}
          getVisiblePathElems={this.getVisiblePathElems}
          setViewModifier={this.setViewModifier}
          showOp={showOp}
          uiFindMatches={uiFindMatches}
          vertices={vertices}
          verticesViewModifiers={verticesViewModifiers}
        />
      );
    } else if (graphState.state === fetchedState.LOADING) {
      content = <LoadingIndicator centered className="u-mt-vast" />;
    } else if (graphState.state === fetchedState.ERROR) {
      content = <ErrorMessage error={graphState.error} className="ub-m4" />;
    } else {
      content = (
        <div>
          <h1>Unknown graphState:</h1>
          <p>${JSON.stringify(graphState)}</p>
        </div>
      );
    }

    return (
      <div className="Ddg">
        <div>
          <Header
            density={density}
            distanceToPathElems={distanceToPathElems}
            hiddenUiFindMatches={hiddenUiFindMatches}
            operation={operation}
            operations={operationsForService && operationsForService[service || '']}
            service={service}
            services={services}
            setDensity={this.setDensity}
            setDistance={this.setDistance}
            setOperation={this.setOperation}
            setService={this.setService}
            showOperations={showOp}
            showParameters={showSvcOpsHeader}
            showVertices={this.showVertices}
            toggleShowOperations={this.toggleShowOperations}
            uiFindCount={uiFind ? uiFindMatches && uiFindMatches.size : undefined}
            visEncoding={visEncoding}
          />
        </div>
        <div className="Ddg--graphWrapper">{content}</div>
      </div>
    );
  }
}

// export for tests
export function mapStateToProps(state: ReduxState, ownProps: TOwnProps): TReduxProps {
  const { services: stServices } = state;
  const { services, operationsForService } = stServices;
  const urlState = getUrlState(ownProps.location.search);
  const { density, operation, service, showOp } = urlState;
  let graphState: TDdgStateEntry | undefined;
  // backend temporarily requires service and operation
  // if (service) {
  if (service && operation) {
    graphState = _get(state.ddg, getStateEntryKey({ service, operation, start: 0, end: 0 }));
  }
  let graph: GraphModel | undefined;
  if (graphState && graphState.state === fetchedState.DONE) {
    graph = makeGraph(graphState.model, showOp, density);
  }
  return {
    graph,
    graphState,
    services,
    operationsForService,
    urlState: sanitizeUrlState(urlState, _get(graphState, 'model.hash')),
    ...extractUiFindFromState(state),
  };
}

// export for tests
export function mapDispatchToProps(dispatch: Dispatch<ReduxState>): TDispatchProps {
  const { fetchDeepDependencyGraph, fetchServiceOperations, fetchServices } = bindActionCreators(
    jaegerApiActions,
    dispatch
  );
  const { addViewModifier, removeViewModifierFromIndices } = bindActionCreators(ddgActions, dispatch);

  return {
    addViewModifier,
    fetchDeepDependencyGraph,
    fetchServiceOperations,
    fetchServices,
    removeViewModifierFromIndices,
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DeepDependencyGraphPageImpl);
