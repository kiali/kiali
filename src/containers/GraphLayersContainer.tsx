import * as React from 'react';
import { Button, Icon, OverlayTrigger, Popover } from 'patternfly-react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { serviceGraphFilterActions } from '../actions/ServiceGraphFilterActions';
import { KialiAppState, ServiceGraphFilterState } from '../store/Store';

interface ServiceGraphDispatch {
  // Dispatch methods
  toggleGraphEdgeLabels(): void;
  toggleGraphNodeLabels(): void;
  toggleGraphCircuitBreakers(): void;
  toggleGraphRouteRules(): void;
}

// inherit all of our Reducer state section  and Dispatch methods for redux
type GraphLayersProps = ServiceGraphDispatch & ServiceGraphFilterState;

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState) => ({
  showEdgeLabels: state.serviceGraphFilterState.showEdgeLabels,
  showNodeLabels: state.serviceGraphFilterState.showNodeLabels,
  showCircuitBreakers: state.serviceGraphFilterState.showCircuitBreakers,
  showRouteRules: state.serviceGraphFilterState.showRouteRules
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: any) => {
  return {
    toggleGraphNodeLabels: bindActionCreators(serviceGraphFilterActions.toggleGraphNodeLabel, dispatch),
    toggleGraphEdgeLabels: bindActionCreators(serviceGraphFilterActions.toggleGraphEdgeLabel, dispatch),
    toggleGraphCircuitBreakers: bindActionCreators(serviceGraphFilterActions.toggleGraphCircuitBreakers, dispatch),
    toggleGraphRouteRules: bindActionCreators(serviceGraphFilterActions.toggleGraphRouteRules, dispatch)
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
  const { showCircuitBreakers, showRouteRules, showEdgeLabels, showNodeLabels } = props;
  // // map or dispatchers for redux
  const { toggleGraphCircuitBreakers, toggleGraphRouteRules, toggleGraphEdgeLabels, toggleGraphNodeLabels } = props;

  const visibilityLayers: VisibilityLayersType[] = [
    {
      id: 'filterCB',
      labelText: 'Circuit Breakers',
      value: showCircuitBreakers,
      onChange: toggleGraphCircuitBreakers
    },
    {
      id: 'filterRR',
      labelText: 'Route Rules',
      value: showRouteRules,
      onChange: toggleGraphRouteRules
    },
    {
      id: 'filterEdges',
      labelText: 'Edge Labels',
      value: showEdgeLabels,
      onChange: toggleGraphEdgeLabels
    },
    {
      id: 'filterNodes',
      labelText: 'Node Labels',
      value: showNodeLabels,
      onChange: toggleGraphNodeLabels
    }
  ];

  const toggleItems = visibilityLayers.map((item: VisibilityLayersType) => (
    <div id={item.id}>
      <label>
        <input name="isGoing" type="checkbox" checked={item.value} onChange={() => item.onChange()} />
        {item.labelText}
      </label>
    </div>
  ));
  const popover = <Popover>{toggleItems}</Popover>;

  return (
    <OverlayTrigger overlay={popover} placement="bottom" trigger={['click']} rootClose={true}>
      <Button>
        <Icon name="filter" />
      </Button>
    </OverlayTrigger>
  );
};

// hook up to Redux for our State to be mapped to props
const GraphLayersContainer = connect(mapStateToProps, mapDispatchToProps)(GraphLayers);
export default GraphLayersContainer;
