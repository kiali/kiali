import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { PropTypes } from 'prop-types';

import { GraphParamsType } from '../../types/Graph';
import * as LayoutDictionary from '../../components/CytoscapeGraph/graphs/LayoutDictionary';
import ServiceGraphPage from '../../containers/ServiceGraphPageContainer';

const URLSearchParams = require('url-search-params');

const SESSION_KEY = 'service-graph-params';

type ServiceGraphURLProps = {
  // @todo: redo this manual params with Redux-Router
  // @todo: add back in circuit-breaker, route-rules params to Redux-Router for URL-params
  duration: string;
  namespace: string;
  layout: string;
};

// TODO put duration, step defaults and Prometheus translation in a single place
const DEFAULT_DURATION = 60;

/**
 * Handle URL parameters for ServiceGraph page
 */
export class ServiceGraphRouteHandler extends React.Component<
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
    return {
      graphDuration: _duration ? { value: _duration } : { value: DEFAULT_DURATION },
      graphLayout: LayoutDictionary.getLayout({ name: urlParams.get('layout') }),
      badgeStatus: { hideCBs: _hideCBs, hideRRs: _hideRRs }
    };
  };

  componentDidMount() {
    // Note: `history.replace` simply changes the address bar text, not re-navigation
    this.context.router.history.replace(this.makeURLFromParams(this.state));
  }

  componentWillReceiveProps(nextProps: RouteComponentProps<ServiceGraphURLProps>) {
    const nextNamespace = { name: nextProps.match.params.namespace };
    const { graphDuration: nextDuration, graphLayout: nextLayout } = this.parseProps(nextProps.location.search);

    const layoutHasChanged = nextLayout.name !== this.state.graphLayout.name;
    const namespaceHasChanged = nextNamespace.name !== this.state.namespace.name;
    const durationHasChanged = nextDuration.value !== this.state.graphDuration.value;

    if (layoutHasChanged || namespaceHasChanged || durationHasChanged) {
      const newParams: GraphParamsType = {
        namespace: nextNamespace,
        graphDuration: nextDuration,
        graphLayout: nextLayout
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newParams));
      this.setState({ ...newParams });
    }
  }

  makeURLFromParams = (params: GraphParamsType) =>
    `/service-graph/${params.namespace.name}?layout=${params.graphLayout.name}&duration=${params.graphDuration.value}`;

  /** Change browser address bar and trigger new props propagation */
  onParamsChange = (params: GraphParamsType) => {
    this.context.router.history.push(this.makeURLFromParams(params));
  };

  render() {
    return <ServiceGraphPage {...this.state} onParamsChange={this.onParamsChange} />;
  }
}
