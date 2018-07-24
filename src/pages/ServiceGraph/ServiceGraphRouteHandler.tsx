import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { PropTypes } from 'prop-types';

import { GraphParamsType, GraphType } from '../../types/Graph';
import { EdgeLabelMode } from '../../types/GraphFilter';
import * as LayoutDictionary from '../../components/CytoscapeGraph/graphs/LayoutDictionary';
import ServiceGraphPage from '../../containers/ServiceGraphPageContainer';
import { makeServiceGraphUrlFromParams } from '../../components/Nav/NavUtils';
import { config } from '../../config';
import * as Enum from '../../utils/Enum';

const URLSearchParams = require('url-search-params');

const SESSION_KEY = 'service-graph-params';

type ServiceGraphURLProps = {
  // @todo: redo this manual params with Redux-Router
  // @todo: add back in circuit-breaker, route-rules params to Redux-Router for URL-params
  duration: string;
  namespace: string;
  layout: string;
  graphType: string;
};

/**
 * Handle URL parameters for ServiceGraph page
 */
export default class ServiceGraphRouteHandler extends React.Component<
  RouteComponentProps<ServiceGraphURLProps>,
  GraphParamsType
> {
  static contextTypes = {
    router: PropTypes.object
  };

  static readonly graphParamsDefaults: GraphParamsType = {
    graphDuration: { value: config().toolbar.defaultDuration },
    graphLayout: LayoutDictionary.getLayout({ name: '' }),
    edgeLabelMode: EdgeLabelMode.HIDE,
    namespace: { name: 'all' },
    graphType: GraphType.APP_PREFERRED,
    versioned: true
  };

  static parseProps = (queryString: string) => {
    const urlParams = new URLSearchParams(queryString);
    const _duration = urlParams.get('duration')
      ? { value: urlParams.get('duration') }
      : ServiceGraphRouteHandler.graphParamsDefaults.graphDuration;
    const _edgeLabelMode = Enum.fromValue(
      EdgeLabelMode,
      urlParams.get('edges'),
      ServiceGraphRouteHandler.graphParamsDefaults.edgeLabelMode
    );
    const _graphType = Enum.fromValue(
      GraphType,
      urlParams.get('graphType'),
      ServiceGraphRouteHandler.graphParamsDefaults.graphType
    );
    const _versioned = urlParams.get('versioned')
      ? urlParams.get('versioned') !== 'false'
      : ServiceGraphRouteHandler.graphParamsDefaults.versioned;

    return {
      graphDuration: _duration,
      graphLayout: LayoutDictionary.getLayout({ name: urlParams.get('layout') }),
      edgeLabelMode: _edgeLabelMode,
      graphType: _graphType,
      versioned: _versioned
    };
  };

  static getDerivedStateFromProps(props: RouteComponentProps<ServiceGraphURLProps>, currentState: GraphParamsType) {
    const nextNamespace = { name: props.match.params.namespace };
    const {
      graphDuration: nextDuration,
      graphLayout: nextLayout,
      edgeLabelMode: nextEdgeLabelMode,
      graphType: nextGraphType,
      versioned: nextVersioned
    } = ServiceGraphRouteHandler.parseProps(props.location.search);

    const layoutHasChanged = nextLayout.name !== currentState.graphLayout.name;
    const namespaceHasChanged = nextNamespace.name !== currentState.namespace.name;
    const durationHasChanged = nextDuration.value !== currentState.graphDuration.value;
    const edgeLabelModeChanged = nextEdgeLabelMode !== currentState.edgeLabelMode;
    const graphTypeChanged = nextGraphType !== currentState.graphType;
    const versionedChanged = nextVersioned !== currentState.versioned;

    if (
      layoutHasChanged ||
      namespaceHasChanged ||
      durationHasChanged ||
      edgeLabelModeChanged ||
      graphTypeChanged ||
      versionedChanged
    ) {
      const newParams: GraphParamsType = {
        namespace: nextNamespace,
        graphDuration: nextDuration,
        graphLayout: nextLayout,
        edgeLabelMode: nextEdgeLabelMode,
        graphType: nextGraphType,
        versioned: nextVersioned
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newParams));
      return { ...newParams };
    }
    return null;
  }

  constructor(routeProps: RouteComponentProps<ServiceGraphURLProps>) {
    super(routeProps);
    const previousParamsStr = sessionStorage.getItem(SESSION_KEY);
    const graphParams: GraphParamsType = previousParamsStr
      ? this.ensureGraphParamsDefaults(JSON.parse(previousParamsStr))
      : {
          namespace: { name: routeProps.match.params.namespace },
          ...ServiceGraphRouteHandler.parseProps(routeProps.location.search)
        };
    this.state = graphParams;
  }

  componentDidMount() {
    // Note: `history.replace` simply changes the address bar text, not re-navigation
    this.context.router.history.replace(makeServiceGraphUrlFromParams(this.state));
  }

  render() {
    return <ServiceGraphPage {...this.state} />;
  }

  // Set default values in case we have an old state that is missing something
  private ensureGraphParamsDefaults(graphParams: any): GraphParamsType {
    return { ...ServiceGraphRouteHandler.graphParamsDefaults, ...graphParams };
  }
}
