import * as React from 'react';
import { Button, Icon, OverlayTrigger, Popover } from 'patternfly-react';
import { PropTypes } from 'prop-types';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { GraphFilterActions } from '../actions/GraphFilterActions';
import { KialiAppState, GraphFilterState } from '../store/Store';
import { style } from 'typestyle';
import { EdgeLabelMode } from '../types/GraphFilter';
import { GraphParamsType } from '../types/Graph';
import { makeNamespaceGraphUrlFromParams, makeNodeGraphUrlFromParams } from '../components/Nav/NavUtils';
import EdgeLabelRadioGroup from '../components/ToolbarDropdown/EdgeLabelRadioGroup';

interface GraphDispatch {
  // Dispatch methods
  toggleGraphNodeLabels(): void;
  toggleGraphCircuitBreakers(): void;
  toggleGraphVirtualServices(): void;
  toggleGraphMissingSidecars(): void;
  toggleTrafficAnimation(): void;
  toggleServiceNodes(): void;
}

// inherit all of our Reducer state section  and Dispatch methods for redux
type GraphSettingsProps = GraphDispatch & GraphFilterState & GraphParamsType;

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState) => ({
  showNodeLabels: state.graph.filterState.showNodeLabels,
  showCircuitBreakers: state.graph.filterState.showCircuitBreakers,
  showVirtualServices: state.graph.filterState.showVirtualServices,
  showMissingSidecars: state.graph.filterState.showMissingSidecars,
  showTrafficAnimation: state.graph.filterState.showTrafficAnimation,
  showServiceNodes: state.graph.filterState.showServiceNodes
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: any) => {
  return {
    toggleGraphNodeLabels: bindActionCreators(GraphFilterActions.toggleGraphNodeLabel, dispatch),
    toggleGraphCircuitBreakers: bindActionCreators(GraphFilterActions.toggleGraphCircuitBreakers, dispatch),
    toggleGraphVirtualServices: bindActionCreators(GraphFilterActions.toggleGraphVirtualServices, dispatch),
    toggleGraphMissingSidecars: bindActionCreators(GraphFilterActions.toggleGraphMissingSidecars, dispatch),
    toggleTrafficAnimation: bindActionCreators(GraphFilterActions.toggleTrafficAnimation, dispatch),
    toggleServiceNodes: bindActionCreators(GraphFilterActions.toggleServiceNodes, dispatch)
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
    }
  }

  handleEdgeLabelModeChange = (event: any) => {
    const edgeLabelMode: EdgeLabelMode = EdgeLabelMode.fromString(event.target.value);

    this.handleFilterChangeToUrl({
      ...this.getGraphParams(),
      edgeLabelMode
    });
  };

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
      showTrafficAnimation,
      showServiceNodes
    } = this.props;

    const graphParams: GraphParamsType = {
      namespace: this.props.namespace,
      node: this.props.node,
      graphLayout: this.props.graphLayout,
      graphDuration: this.props.graphDuration,
      edgeLabelMode: this.props.edgeLabelMode,
      graphType: this.props.graphType,
      injectServiceNodes: this.props.showServiceNodes
    };

    // map or dispatchers for redux
    const {
      toggleGraphCircuitBreakers,
      toggleGraphVirtualServices,
      toggleGraphNodeLabels,
      toggleGraphMissingSidecars,
      toggleTrafficAnimation,
      toggleServiceNodes
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
        <label>Display:</label>
        {displaySettingItems}
        <div className={spacerStyle} />
        <label>Badges:</label>
        {badgeItems}
        <div className={spacerStyle} />
        <EdgeLabelRadioGroup graphParams={graphParams} onEdgeChanged={this.handleEdgeLabelModeChange} />
      </Popover>
    );

    const alignWithGraphHeaderStyle = style({ marginLeft: -40 });

    return (
      <span className={alignWithGraphHeaderStyle}>
        <OverlayTrigger overlay={graphSettingsPopover} placement="bottom" trigger={['click']} rootClose={true}>
          <Button>
            Graph Settings <Icon name="angle-down" />
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
