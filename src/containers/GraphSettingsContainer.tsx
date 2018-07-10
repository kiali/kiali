import * as React from 'react';
import { Button, DropdownButton, Icon, MenuItem, OverlayTrigger, Popover } from 'patternfly-react';
import { PropTypes } from 'prop-types';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { serviceGraphFilterActions } from '../actions/ServiceGraphFilterActions';
import { KialiAppState, ServiceGraphFilterState } from '../store/Store';
import { style } from 'typestyle';
import GraphFilter from '../components/GraphFilter/GraphFilter';
import { EdgeLabelMode, Layout } from '../types/GraphFilter';
import { GraphParamsType } from '../types/Graph';
import { makeServiceGraphUrlFromParams } from '../components/Nav/NavUtils';
import EdgeLabelRadioGroup from '../components/ToolbarDropdown/EdgeLabelRadioGroup';

interface ServiceGraphDispatch {
  // Dispatch methods
  toggleLegend(): void;
  toggleGraphNodeLabels(): void;
  toggleGraphCircuitBreakers(): void;
  toggleGraphVirtualServices(): void;
  toggleGraphMissingSidecars(): void;
  toggleTrafficAnimation(): void;
}

// inherit all of our Reducer state section  and Dispatch methods for redux
type GraphSettingsProps = ServiceGraphDispatch & ServiceGraphFilterState & GraphParamsType;

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState) => ({
  showLegend: state.serviceGraph.filterState.showLegend,
  showNodeLabels: state.serviceGraph.filterState.showNodeLabels,
  showCircuitBreakers: state.serviceGraph.filterState.showCircuitBreakers,
  showVirtualServices: state.serviceGraph.filterState.showVirtualServices,
  showMissingSidecars: state.serviceGraph.filterState.showMissingSidecars,
  showTrafficAnimation: state.serviceGraph.filterState.showTrafficAnimation
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: any) => {
  return {
    toggleLegend: bindActionCreators(serviceGraphFilterActions.toggleLegend, dispatch),
    toggleGraphNodeLabels: bindActionCreators(serviceGraphFilterActions.toggleGraphNodeLabel, dispatch),
    toggleGraphCircuitBreakers: bindActionCreators(serviceGraphFilterActions.toggleGraphCircuitBreakers, dispatch),
    toggleGraphVirtualServices: bindActionCreators(serviceGraphFilterActions.toggleGraphVirtualServices, dispatch),
    toggleGraphMissingSidecars: bindActionCreators(serviceGraphFilterActions.toggleGraphMissingSidecars, dispatch),
    toggleTrafficAnimation: bindActionCreators(serviceGraphFilterActions.toggleTrafficAnimation, dispatch)
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

  handleLayoutChange = (layout: string) => {
    const graphLayout: Layout = { name: layout };
    this.handleFilterChangeToUrl({
      ...this.getGraphParams(),
      graphLayout
    });
  };

  handleEdgeLabelModeChange = (event: any) => {
    const edgeLabelMode: EdgeLabelMode = EdgeLabelMode.fromString(event.target.value);

    this.handleFilterChangeToUrl({
      ...this.getGraphParams(),
      edgeLabelMode
    });
  };

  handleFilterChangeToUrl = (params: GraphParamsType) => {
    this.context.router.history.push(makeServiceGraphUrlFromParams(params));
  };

  render() {
    // map our attributes from redux
    const {
      showLegend,
      showCircuitBreakers,
      showVirtualServices,
      showNodeLabels,
      showMissingSidecars,
      showTrafficAnimation
    } = this.props;

    const graphParams: GraphParamsType = {
      namespace: this.props.namespace,
      graphLayout: this.props.graphLayout,
      graphDuration: this.props.graphDuration,
      edgeLabelMode: this.props.edgeLabelMode
    };

    // map or dispatchers for redux
    const {
      toggleLegend,
      toggleGraphCircuitBreakers,
      toggleGraphVirtualServices,
      toggleGraphNodeLabels,
      toggleGraphMissingSidecars,
      toggleTrafficAnimation
    } = this.props;

    const visibilityLayers: VisibilityLayersType[] = [
      {
        id: 'filterNodes',
        labelText: 'Node Names',
        value: showNodeLabels,
        onChange: toggleGraphNodeLabels
      },
      {
        id: 'filterTrafficAnimation',
        labelText: 'Traffic Animation',
        value: showTrafficAnimation,
        onChange: toggleTrafficAnimation
      },
      {
        id: 'toggleLegend',
        labelText: 'Legend',
        value: showLegend,
        onChange: toggleLegend
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

    const layoutItems = Object.keys(GraphFilter.GRAPH_LAYOUTS).map((layoutKey: string) => (
      <MenuItem active={layoutKey === graphParams.graphLayout.name} key={layoutKey} eventKey={layoutKey}>
        {GraphFilter.GRAPH_LAYOUTS[layoutKey]}
      </MenuItem>
    ));

    const layoutDropdown = (
      <>
        <div>
          <label>Layout Schema:</label>
        </div>
        <div>
          <DropdownButton
            id="graph_filter_layout"
            title={GraphFilter.GRAPH_LAYOUTS[graphParams.graphLayout.name]}
            onSelect={this.handleLayoutChange}
          >
            {layoutItems}
          </DropdownButton>
        </div>
      </>
    );

    const graphSettingsPopover = (
      <Popover id="layers-popover">
        <label>Display:</label>
        {displaySettingItems}
        <div className={spacerStyle} />
        <label>Badges:</label>
        {badgeItems}
        <div className={spacerStyle} />
        <EdgeLabelRadioGroup graphParams={graphParams} onEdgeChanged={this.handleEdgeLabelModeChange} />
        <div className={spacerStyle} />
        {layoutDropdown}
      </Popover>
    );

    const alignWithServiceGraphHeaderStyle = style({ marginLeft: -40 });

    return (
      <span className={alignWithServiceGraphHeaderStyle}>
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
      graphDuration: this.props.graphDuration,
      graphLayout: this.props.graphLayout,
      edgeLabelMode: this.props.edgeLabelMode
    };
  };
}

// hook up to Redux for our State to be mapped to props
const GraphSettingsContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphSettings);
export default GraphSettingsContainer;
