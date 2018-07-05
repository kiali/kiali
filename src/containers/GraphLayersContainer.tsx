import * as React from 'react';
import { Button, Icon, OverlayTrigger, Popover } from 'patternfly-react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { serviceGraphFilterActions } from '../actions/ServiceGraphFilterActions';
import { KialiAppState, ServiceGraphFilterState } from '../store/Store';
import { style } from 'typestyle';

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
type GraphLayersProps = ServiceGraphDispatch & ServiceGraphFilterState;

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
    setGraphEdgeLabelMode: bindActionCreators(serviceGraphFilterActions.setGraphEdgeLabelMode, dispatch),
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

// Show/Hide Graph Visibility Layers -- there will be many
// Right now it is a toolbar with Switch Buttons -- this will change once with UXD input
export const GraphLayers: React.SFC<GraphLayersProps> = props => {
  // map our attributes from redux
  const {
    showLegend,
    showCircuitBreakers,
    showVirtualServices,
    showNodeLabels,
    showMissingSidecars,
    showTrafficAnimation
  } = props;
  // // map or dispatchers for redux
  const {
    toggleLegend,
    toggleGraphCircuitBreakers,
    toggleGraphVirtualServices,
    toggleGraphNodeLabels,
    toggleGraphMissingSidecars,
    toggleTrafficAnimation
  } = props;

  const visibilityLayers: VisibilityLayersType[] = [
    {
      id: 'toggleLegend',
      labelText: 'Legend',
      value: showLegend,
      onChange: toggleLegend
    },
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
      id: 'filterNodes',
      labelText: 'Node Labels',
      value: showNodeLabels,
      onChange: toggleGraphNodeLabels
    },
    {
      id: 'filterSidecars',
      labelText: 'Missing Sidecars',
      value: showMissingSidecars,
      onChange: toggleGraphMissingSidecars
    },
    {
      id: 'filterTrafficAnimation',
      labelText: 'Traffic Animation',
      value: showTrafficAnimation,
      onChange: toggleTrafficAnimation
    }
  ];

  const checkboxStyle = style({ marginLeft: 5 });
  const toggleItems = visibilityLayers.map((item: VisibilityLayersType) => (
    <div id={item.id} key={item.id}>
      <label>
        <input type="checkbox" checked={item.value} onChange={() => item.onChange()} />
        <span className={checkboxStyle}>{item.labelText}</span>
      </label>
    </div>
  ));
  const popover = <Popover id="layers-popover">{toggleItems}</Popover>;

  return (
    <OverlayTrigger overlay={popover} placement="bottom" trigger={['click']} rootClose={true}>
      <Button>
        <Icon name="filter" />
      </Button>
    </OverlayTrigger>
  );
};

// hook up to Redux for our State to be mapped to props
const GraphLayersContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphLayers);
export default GraphLayersContainer;
