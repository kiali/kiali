import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { PropTypes } from 'prop-types';

import { GraphParamsType } from '../../types/Graph';
import { EdgeLabelMode } from '../../types/GraphFilter';
import * as LayoutDictionary from '../../components/CytoscapeGraph/graphs/LayoutDictionary';
import ServiceGraphPage from '../../containers/ServiceGraphPageContainer';
import { makeURLFromParams } from '../../components/Nav/NavUtils';
import { config } from '../../config';

const URLSearchParams = require('url-search-params');

const SESSION_KEY = 'service-graph-params';

type ServiceGraphURLProps = {
  // @todo: redo this manual params with Redux-Router
  // @todo: add back in circuit-breaker, route-rules params to Redux-Router for URL-params
  duration: string;
  namespace: string;
  layout: string;
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

  constructor(routeProps: RouteComponentProps<ServiceGraphURLProps>) {
    super(routeProps);
    const previousParamsStr = sessionStorage.getItem(SESSION_KEY);
    const graphParams: GraphParamsType = previousParamsStr
      ? JSON.parse(previousParamsStr)
      : {
          namespace: { name: routeProps.match.params.namespace },
          ...this.parseProps(routeProps.location.search)
        };
    this.state = graphParams;
  }

  parseProps = (queryString: string) => {
    const urlParams = new URLSearchParams(queryString);
    // TODO: [KIALI-357] validate `duration`
    const _duration = urlParams.get('duration');
    const _hideCBs = urlParams.get('hideCBs') ? urlParams.get('hideCBs') === 'true' : false;
    const _hideRRs = urlParams.get('hideRRs') ? urlParams.get('hideRRs') === 'true' : false;
    const _edgeLabelMode = EdgeLabelMode.fromString(urlParams.get('edges'), EdgeLabelMode.HIDE);
    return {
      graphDuration: _duration ? { value: _duration } : { value: config().toolbar.defaultDuration },
      graphLayout: LayoutDictionary.getLayout({ name: urlParams.get('layout') }),
      badgeStatus: { hideCBs: _hideCBs, hideRRs: _hideRRs },
      edgeLabelMode: _edgeLabelMode
    };
  };

  componentDidMount() {
    // Note: `history.replace` simply changes the address bar text, not re-navigation
    this.context.router.history.replace(makeURLFromParams(this.state));
  }

  componentWillReceiveProps(nextProps: RouteComponentProps<ServiceGraphURLProps>) {
    const nextNamespace = { name: nextProps.match.params.namespace };
    const { graphDuration: nextDuration, graphLayout: nextLayout, edgeLabelMode: nextEdgeLabelMode } = this.parseProps(
      nextProps.location.search
    );

    const layoutHasChanged = nextLayout.name !== this.state.graphLayout.name;
    const namespaceHasChanged = nextNamespace.name !== this.state.namespace.name;
    const durationHasChanged = nextDuration.value !== this.state.graphDuration.value;
    const edgeLabelModeChanged = nextEdgeLabelMode !== this.state.edgeLabelMode;

    if (layoutHasChanged || namespaceHasChanged || durationHasChanged || edgeLabelModeChanged) {
      const newParams: GraphParamsType = {
        namespace: nextNamespace,
        graphDuration: nextDuration,
        graphLayout: nextLayout,
        edgeLabelMode: nextEdgeLabelMode
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newParams));
      this.setState({ ...newParams });
    }
  }

  render() {
    return <ServiceGraphPage {...this.state} />;
  }
}
