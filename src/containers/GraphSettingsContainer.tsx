import * as React from 'react';
import { Button, Icon, OverlayTrigger, Popover } from 'patternfly-react';
import { PropTypes } from 'prop-types';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { GraphFilterActions } from '../actions/GraphFilterActions';
import { KialiAppState, GraphFilterState } from '../store/Store';
import { style } from 'typestyle';
import { GraphParamsType } from '../types/Graph';
import { makeNamespaceGraphUrlFromParams, makeNodeGraphUrlFromParams } from '../components/Nav/NavUtils';
import { GraphDataActions } from '../actions/GraphDataActions';
import { store } from '../store/ConfigStore';

interface GraphDispatch {
  // Dispatch methods
  toggleGraphNodeLabels(): void;
  toggleGraphCircuitBreakers(): void;
  toggleGraphVirtualServices(): void;
  toggleGraphMissingSidecars(): void;
  toggleGraphSecurity(): void;
  toggleServiceNodes(): void;
  toggleTrafficAnimation(): void;
  toggleUnusedNodes(): void;
}

// inherit all of our Reducer state section  and Dispatch methods for redux
type GraphSettingsProps = GraphDispatch & GraphFilterState & GraphParamsType;

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState) => ({
  showNodeLabels: state.graph.filterState.showNodeLabels,
  showCircuitBreakers: state.graph.filterState.showCircuitBreakers,
  showVirtualServices: state.graph.filterState.showVirtualServices,
  showMissingSidecars: state.graph.filterState.showMissingSidecars,
  showSecurity: state.graph.filterState.showSecurity,
  showServiceNodes: state.graph.filterState.showServiceNodes,
  showTrafficAnimation: state.graph.filterState.showTrafficAnimation,
  showUnusedNodes: state.graph.filterState.showUnusedNodes
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: any) => {
  return {
    toggleGraphNodeLabels: bindActionCreators(GraphFilterActions.toggleGraphNodeLabel, dispatch),
    toggleGraphCircuitBreakers: bindActionCreators(GraphFilterActions.toggleGraphCircuitBreakers, dispatch),
    toggleGraphVirtualServices: bindActionCreators(GraphFilterActions.toggleGraphVirtualServices, dispatch),
    toggleGraphMissingSidecars: bindActionCreators(GraphFilterActions.toggleGraphMissingSidecars, dispatch),
    toggleGraphSecurity: bindActionCreators(GraphFilterActions.toggleGraphSecurity, dispatch),
    toggleServiceNodes: bindActionCreators(GraphFilterActions.toggleServiceNodes, dispatch),
    toggleTrafficAnimation: bindActionCreators(GraphFilterActions.toggleTrafficAnimation, dispatch),
    toggleUnusedNodes: bindActionCreators(GraphFilterActions.toggleUnusedNodes, dispatch)
  };
};

interface VisibilityLayersType {
  id: string;
  labelText: string;
  value: boolean;
  onChange: () => void;
}

class GraphSettings extends React.PureComponent<GraphSettingsProps> {
  static contextTypes = {
    router: PropTypes.object
  };

  constructor(props: GraphSettingsProps) {
    super(props);
    // ensure setting is initialized to match the url
    if (props.showServiceNodes !== props.injectServiceNodes) {
      this.props.toggleServiceNodes();
    }
  }

  componentDidUpdate(prevProps: GraphSettingsProps) {
    if (this.props.showServiceNodes !== prevProps.showServiceNodes) {
      this.handleFilterChangeToUrl({
        ...this.getGraphParams(),
        injectServiceNodes: this.props.showServiceNodes
      });
    } else if (
      (this.props.showSecurity && this.props.showSecurity !== prevProps.showSecurity) ||
      this.props.showUnusedNodes !== prevProps.showUnusedNodes
    ) {
      // when turning on security, or toggling unused node, we need to perform a fetch, because we don't pull
      // security or unused node data by default.
      store.dispatch(
        // @ts-ignore
        GraphDataActions.fetchGraphData(
          this.props.namespace,
          this.props.graphDuration,
          this.props.graphType,
          this.props.injectServiceNodes,
          this.props.edgeLabelMode,
          this.props.showSecurity,
          this.props.showUnusedNodes,
          this.props.node
        )
      );
    }
  }

  handleFilterChangeToUrl = (params: GraphParamsType) => {
    document.body.click(); // close the layover
    if (params.node) {
      this.context.router.history.push(makeNodeGraphUrlFromParams(params.node, params));
    } else {
      this.context.router.history.push(makeNamespaceGraphUrlFromParams(params));
    }
  };

  render() {
    // map our attributes from redux
    const {
      showCircuitBreakers,
      showVirtualServices,
      showNodeLabels,
      showMissingSidecars,
      showSecurity,
      showServiceNodes,
      showTrafficAnimation,
      showUnusedNodes
    } = this.props;

    // map or dispatchers for redux
    const {
      toggleGraphCircuitBreakers,
      toggleGraphVirtualServices,
      toggleGraphNodeLabels,
      toggleGraphMissingSidecars,
      toggleGraphSecurity,
      toggleServiceNodes,
      toggleTrafficAnimation,
      toggleUnusedNodes
    } = this.props;

    const visibilityLayers: VisibilityLayersType[] = [
      {
        id: 'filterNodes',
        labelText: 'Node Names',
        value: showNodeLabels,
        onChange: toggleGraphNodeLabels
      },
      {
        id: 'filterServiceNodes',
        labelText: 'Service Nodes',
        value: showServiceNodes,
        onChange: toggleServiceNodes
      },
      {
        id: 'filterTrafficAnimation',
        labelText: 'Traffic Animation',
        value: showTrafficAnimation,
        onChange: toggleTrafficAnimation
      },
      {
        id: 'filterUnusedNodes',
        labelText: 'Unused Nodes',
        value: showUnusedNodes,
        onChange: toggleUnusedNodes
      }
    ];

    const badges: VisibilityLayersType[] = [
      {
        id: 'filterCB',
        labelText: 'Circuit Breakers',
        value: showCircuitBreakers,
        onChange: toggleGraphCircuitBreakers
      },
      {
        id: 'filterVS',
        labelText: 'Virtual Services',
        value: showVirtualServices,
        onChange: toggleGraphVirtualServices
      },
      {
        id: 'filterSidecars',
        labelText: 'Missing Sidecars',
        value: showMissingSidecars,
        onChange: toggleGraphMissingSidecars
      },
      {
        id: 'filterSecurity',
        labelText: 'Security',
        value: showSecurity,
        onChange: toggleGraphSecurity
      }
    ];

    const checkboxStyle = style({ marginLeft: 5 });

    const displaySettingItems = visibilityLayers.map((item: VisibilityLayersType) => (
      <div id={item.id} key={item.id}>
        <label>
          <input type="checkbox" checked={item.value} onChange={() => item.onChange()} />
          <span className={checkboxStyle}>{item.labelText}</span>
        </label>
      </div>
    ));

    const badgeItems = badges.map((item: VisibilityLayersType) => (
      // @todo: consolidate into single function
      <div id={item.id} key={item.id}>
        <label>
          <input type="checkbox" checked={item.value} onChange={() => item.onChange()} />
          <span className={checkboxStyle}>{item.labelText}</span>
        </label>
      </div>
    ));

    const spacerStyle = style({
      height: '1em'
    });

    const graphSettingsPopover = (
      <Popover id="layers-popover">
        {displaySettingItems}
        <div className={spacerStyle} />
        <label>Badges:</label>
        {badgeItems}
        <div className={spacerStyle} />
      </Popover>
    );

    const alignWithGraphHeaderStyle = style({ marginLeft: -40 });

    return (
      <span className={alignWithGraphHeaderStyle}>
        <OverlayTrigger overlay={graphSettingsPopover} placement="bottom" trigger={['click']} rootClose={true}>
          <Button>
            Display <Icon name="angle-down" />
          </Button>
        </OverlayTrigger>
      </span>
    );
  }

  private getGraphParams: () => GraphParamsType = () => {
    return {
      namespace: this.props.namespace,
      node: this.props.node,
      graphDuration: this.props.graphDuration,
      graphLayout: this.props.graphLayout,
      edgeLabelMode: this.props.edgeLabelMode,
      graphType: this.props.graphType,
      injectServiceNodes: this.props.injectServiceNodes
    };
  };
}

// hook up to Redux for our State to be mapped to props
const GraphSettingsContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphSettings);
export default GraphSettingsContainer;
